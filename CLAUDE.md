# Other md files

.claude/unit-tests.md
.claude/react.md
.claude/tailwind.md
.claude/security.md

# Code style

- Use ES modules (import/export) syntax, not commonJS (require)
- Destructure imports when possible (e.g. import { foo } from 'bar')
- Async work inside `useEffect`: declare a named inner function and call it (not an IIFE). Pass `AbortSignal` from a controller created in the effect, abort unconditionally in the cleanup, and ignore `AbortError` in the catch. Named functions show in stack traces; AbortController cancels the actual request instead of just discarding the response. See `src/client/hooks/useCompatibilityExtremes.ts` for the canonical shape. Extend `apiService` methods with an optional `signal?: AbortSignal` parameter as you touch them — don't retrofit all at once.
- Comments: default to none. When a comment is warranted (non-obvious WHY only — workaround, hidden constraint, surprising invariant), keep it to ≤2 lines. Multi-paragraph explanations belong in the PR description or commit body, not in source — they bloat files and rot in place.

# BPDiscord

Full-stack TypeScript app that analyzes Letterboxd rating data. React 19 + Vite client, Express + TypeScript server, Supabase Postgres, JWT auth via Supabase. Yarn workspaces. Vite dev proxy fronts the API.

Scraping is **not** in this Node process — it runs in a separate Python worker (**moviemaestro**, deployed on Railway). This server is a thin orchestrator that inserts a job row and POSTs to the worker.

## Scraping pipeline (moviemaestro worker)

All Letterboxd scraping is performed by moviemaestro (`WORKER_URL=https://moviemaestro.up.railway.app`). The Node server **does not** run Puppeteer, Cheerio, or any browser. A refresh works like:

1. Insert a row into `user_scrape_jobs` (per-user) or `refresh_jobs` (admin bulk) with `status='running'`. A partial unique index makes the insert single-flight.
2. POST `{job_id, ...}` to moviemaestro with `Authorization: Bearer ${WORKER_SHARED_SECRET}`. 10s fetch timeout.
3. Return `202 {job_id}` to the client; the client polls `GET /api/scrape-user/jobs/:id` (or `/api/admin/refresh-rankings/:id`) every 2s.
4. moviemaestro scrapes Letterboxd with `letterboxdpy`, writes to `Users` / `UserRatings` / `UserFilms` / `Films` directly using the Supabase service-role key, and updates the job row's `status` / `phase` / `progress` / `errors` as it progresses.
5. Terminal states (`completed` / `failed` / `cancelled`) stop the client's polling loop.

If the worker handoff fails (502, timeout, etc.), the controller rolls back the job row to `status='failed'` so the partial unique index releases and the next trigger can succeed.

**Why this architecture:** Puppeteer in a Vercel serverless function is fragile (cold-start, memory limits, Chromium binary), and the previous in-Node implementation was responsible for most of the server's complexity and production failures. Offloading to a long-lived Python worker means scraping runs on hardware sized for it, and the Node tier stays a thin orchestration layer.

**Worker handoff security**: `WORKER_SHARED_SECRET` Bearer token on every server→worker call. Job rows scoped by `started_by`; partial unique indexes prevent concurrent duplicate work at the DB level.

## Database schema — non-obvious bits

Tables `Users`, `UserRatings`, `Films`, `UserFilms` are straightforward — see `src/server/db/schema.ts` and `supabase/migrations/` for columns.

The **actor-graph** tables have semantics that aren't obvious from the columns:

- **`ag_actors`** / **`ag_films`** — both carry a `fully_fetched` / `cast_fully_fetched` flag. Lightweight inserts (e.g. a film discovered via an actor's filmography, or an actor discovered via a movie's cast) leave the flag `false`. Only a full `/person/:id?append_to_response=movie_credits` or `/movie/:id?append_to_response=credits` hydrates the row and sets it `true`. **Never let a lightweight upsert clobber a richer row's flag back to false.**
- **`ag_acted_in`** — actor↔film edges. `billing_order` (lower = more prominent) is used by the path-finder to prune long-tail credits (extras, voice roles). The reverse-direction index `idx_ag_acted_in_movie_actor` on `(movie_tmdb_id, actor_tmdb_id)` is required by the BFS, which joins on `movie_tmdb_id` to find co-stars. Created in `supabase/migrations/20260505013813_add_ag_graph_indexes.sql` alongside `pg_trgm` GIN indexes on `ag_actors.name` / `ag_films.title` that power the search endpoint.

## API surface

Routes are defined under `src/server/routes/`. Quick map:

- `/api/auth` — signup / login / forgot-password (server-mediated)
- `/api/film-users` — **public, DB-only reads** of Letterboxd data. 404 on miss (hint user to trigger a refresh). No fallback scraping; the legacy `?fallback=scrape` query param was removed when Puppeteer was retired.
- `/api/scrape-user` — **JWT-authed** per-user refresh job (trigger / poll / cancel). Delegates to moviemaestro. Per-username rate limit 10 req / 5 min; poll 120 req / 60s per IP.
- `/api/admin/refresh-rankings` — **admin only** bulk refresh, same delegation pattern.
- `/api/comparison` — public read endpoints powering the compare + hater-rankings pages.
- `/api/actor-graph` — public, **cache-through to TMDB** for the Six-Degrees feature:
  - `path-finder/:a1/:a2` — layer-by-layer BFS over `ag_acted_in` (one indexed self-join per layer, global visited map; O(V+E) over the connected component). Rate-limited tighter: 20 req / 5 min per IP.
  - `search?q=...` — merges DB hits (pg_trgm GIN, ILIKE wildcards `%`/`_`/`\` escaped) with TMDB `/search/person`+`/search/movie`. Either source degrades gracefully on the other's failure. `q` length clamped 2–80. Rate-limited 60 req / 5 min per IP.
  - `actors/:id`, `movies/:id`, `actors/:id/costars`, `actors/:a1/common-movies/:a2` — cache-through; ingestion rate-limited 120 req / 5 min per IP.
  - Public despite being cache-through writers: writes are bounded (top-15 cast per ingestion), source is TMDB (itself public), per-IP rate limiters cap abuse. Requires `TMDB_READ_API_TOKEN` (503 if unset).
- `/api/users` — JWT-protected CRUD for app accounts (admin-only for list/edit/delete of others).

### Actor-graph controller error handling

Diverges from the rest of the codebase. Pure-DB helpers throw; handlers wrap in try/catch and route everything (DB errors, `TmdbNotFoundError`, `TmdbUnavailableError`, `AxiosError`) through `classifyError` → 404 / 503 / 502 / 429 / 500. `dataController` and `eventDataController` keep using the `dbOperation` result type. Don't try to unify these.

### Cross-instance ingestion races

In-process request coalescing dedupes concurrent same-id ingestions within a single Node instance. Cross-instance races (e.g. Vercel parallel lambdas) fall through to `ON CONFLICT DO UPDATE` — bounded cost, no correctness impact.

## Database-first architecture

1. **Read path** — all client-facing endpoints are DB queries. No synchronous calls to Letterboxd, no Puppeteer, no fallback scraping in the request lifecycle.
2. **Write path** — refresh jobs are async, delegated to moviemaestro. The Node server is a thin orchestrator.
3. **TMDB cache-through** — `/api/actor-graph` is the one exception. Writes on cache miss, but only to TMDB-backed tables, and bounded per request.

## Authentication — non-obvious bits

- **Login / signup** are on **separate routes** (`/login` and `/signup`), not a single combined page.
- **Password reset is client-direct via the Supabase JS SDK** (not server-mediated like login/signup). The recovery email link lands in the browser, not on the server, so:
  1. `POST /api/auth/forgot-password` → server calls `supabase.auth.resetPasswordForEmail` → Supabase emails the user
  2. Email link → `/reset-password#access_token=...&type=recovery`
  3. SDK auto-extracts the code from the URL hash and establishes an **in-memory** session (`persistSession: false`)
  4. After `updateUser({ password })` succeeds, **sign out the recovery session** before navigating to `/login` — we don't want an email-link click alone to grant an authenticated session
  - Requires `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` on the client.
- **Admin editing own email** → server returns `requiresReauth: true`; the page clears the token and redirects to `/login` (the old JWT just rotated).
- **Admin user table** unclaimed-lbusername datalist is the intersection of `GET /api/film-users` minus `GET /api/admin/users` lbusernames. The currently-edited account's own lbusername is intentionally included even though it's "claimed" so the current value stays valid.
- **Admin self-delete is disabled** in the UI (forced to use Supabase Studio; the FK cascade would invalidate the in-flight JWT mid-request).
- The page-level admin gate (`user.user_metadata.role === 'admin'`) is **UX only**. The real gate is the server-side `authorizeAdmin` middleware.

## Development

```bash
yarn install:all
yarn dev          # PROD Supabase — normal workflow with real data
yarn dev:local    # LOCAL Supabase — smoke environment with fixtures
yarn build
```

Env-var templates: `src/server/.env.example`, `src/server/.env.smoke.example`, `src/client/.env.example`, `src/client/.env.smoke.example`.

### Local smoke testing

`yarn dev` always points at the **prod** Supabase — that's the day-to-day workflow. The local smoke environment exists only for PR testing and is **explicit opt-in**. File presence alone never switches the mode.

**One-time bootstrap** (idempotent):

```bash
supabase start            # local Postgres + Auth + Studio on :54321
yarn setup:local          # writes src/server/.env.smoke + src/client/.env.smoke
                          # from `supabase status -o env`, then seeds an admin
                          # user + fixture Discord users / films / ratings
```

- `src/server/.env.smoke` (gitignored) — loaded by `loadEnv.ts` *before* `.env` **only when `SMOKE_LOCAL=1`** (i.e. `yarn dev:local`).
- `src/client/.env.smoke` (gitignored) — loaded by Vite **only when started with `--mode smoke`** (i.e. `yarn dev:client:local`).

The deliberate non-collision with `.env.local` is so Vite's "always-auto-load `.env.local`" convention can't silently point normal dev at the local stack. Setup deletes legacy `.env.local` files for the same reason.

Seeded admin lives in **local** Supabase only:
- email: `admin@local.test` / password: `dev-admin-pw` / role: `admin`
- override with `yarn setup:local --email <x> --password <y> --name <z> --lbusername <n> [--force]`

Fixtures: 5 fake Discord users, 20 films, ~75 UserFilms. Idempotent upsert. Skip with `--no-fixtures`. **Known limitation**: the "Highest rated movies (20+ ratings)" homepage section stays empty — its threshold is impossible with 5 fake users.

Server startup breadcrumb confirms which mode:
```
[env] .env only             → REMOTE https://bvadmlitqvahdatjtpgz.supabase.co
[env] .env.smoke + .env     → LOCAL  http://127.0.0.1:54321
```

**Known limitation**: `WORKER_URL` is unset in `.env.smoke` by design. `/api/scrape-user/*` and `/api/admin/refresh-rankings` return 500 *"Worker not configured"* in smoke mode — test worker scenarios in staging or against prod with a non-prod Letterboxd username.

**Test DB caveat**: smoke-seeded fixtures live in the same local Supabase instance the test suite uses. Run `yarn test` *before* `yarn setup:local` for a clean test run. Isolation fix tracked in `bpdiscord-141`.

## Database migrations

Managed via the Supabase CLI under `supabase/migrations/`. Files are timestamped (`YYYYMMDDhhmmss_*.sql`) and tracked in `supabase_migrations.schema_migrations`.

> **Drizzle vs. Supabase CLI.** `src/server/db/schema.ts` declares tables, columns, and indexes for Drizzle's query builder + type inference, but `drizzle-kit push`/`drizzle-kit migrate` is **not** part of the deploy pipeline. SQL changes must land as a `supabase/migrations/*.sql` file or they won't exist in any DB. Treat Drizzle schema declarations as documentary; the SQL migration is the source of truth.

Layout notes:
- `20260502215921_remote_schema.sql` — baseline from `supabase db pull`. Never edit re-creatively; treat as a frozen snapshot. Drop targeted DDL via follow-ups.
- `20260505013813_add_ag_graph_indexes.sql` — `pg_trgm` extension + reverse-direction edge index + GIN trigram indexes. Required for path-finder + search perf.
- `20260505015531_drop_ag_acted_in_clone.sql` — drops a dev artifact captured by the initial `db pull`.

Local: `supabase start`, `supabase status`, `supabase db reset`, `supabase migration new <name>`.

Production: a push to `main` touching `supabase/migrations/**` triggers `.github/workflows/migrations.yml` — a `plan` job (`supabase migration list --linked`) followed by a manual-approval `migrate` job gated on the `production` GitHub environment. **That environment must have required reviewers configured** in repo Settings → Environments, otherwise the gate is a silent no-op.

Required repo secrets: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_REF`.

**One-time prod baseline repair** (already done; documented for reference): because the baseline was generated from `supabase db pull` against a populated prod, applying it would error on duplicate constraints. It was marked applied without running via `supabase migration repair --status applied 20260502215921`.

## Git workflow — never commit directly to main

**All code changes must land on `main` via a pull request from a feature branch. Direct commits or pushes to `main` are not allowed under any circumstances.**

If the user asks for changes while the local branch is `main`:

1. **First**, create a new branch — e.g. `git checkout -b <topic>` — using a short kebab-case name. If there's a beads issue, include its short code (e.g. `feat/scrape-removal-bpdiscord-5rn`).
2. Make the changes, commit, and `git push -u origin <branch>` on the new branch.
3. Open a pull request with `gh pr create`. Reference the beads issue in the PR body.
4. **Do not** `git push` to `main` even if the working branch is `main`. If you realise you've committed on `main` by mistake, before pushing: create the branch from `HEAD`, then reset `main` back to `origin/main` (`git branch <topic>` + `git reset --hard origin/main`), then push the new branch.

This rule has no exceptions — not for tiny fixes, not for "obvious" changes, not for docs-only commits. PR-only workflow is enforced because (a) it preserves the review trail visible in `git log`, (b) it keeps CI gates intact, and (c) it gives the user a chance to catch problems before they hit `main`.

## Beads issue tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Keeping CLAUDE.md in sync

CLAUDE.md is the source-of-truth for engineers (and AI agents) starting on the project. Doc-code drift is a real cost — e.g. a React 18 / React 19 mismatch caught during Stage 3 planning, where the docs said 18 but the codebase was already on 19.

Before opening any PR, check whether the changes affect anything documented here. If yes, update CLAUDE.md as part of the **same PR**.

Watch for: stack versions (React, Tailwind, Drizzle, etc.), table/schema/FK/RLS changes, route topology, new required env vars, convention changes.

## Session completion

**When ending a work session**, complete ALL steps below. Work is NOT complete until `git push` succeeds.

1. File issues for remaining work
2. Run quality gates (tests, linters, builds) if code changed
3. Update issue status — close finished work, update in-progress items
4. **Push to remote** (mandatory):
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. Clean up — clear stashes, prune remote branches
6. Verify — all changes committed AND pushed
7. Hand off — provide context for next session

**Critical:** work is NOT complete until `git push` succeeds. If push fails, resolve and retry until it succeeds.
