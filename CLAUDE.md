# Other md files

Both are committed — `.gitignore` re-includes them out of an otherwise-ignored `.claude/`, so they ship with a clone and get reviewed like code.

- `.claude/security.md` — authorization, mutation safety, input validation, client token handling. Every rule maps to a real incident in this codebase.
- `.claude/unit-tests.md` — test file layout, the shared fetch-hook factory, and helper rules.

Anything else under `.claude/` (settings, hooks, worktrees) is local-only and must not be relied on in docs or tooling.

# Code style

- Use ES modules (import/export) syntax, not commonJS (require)
- Destructure imports when possible (e.g. import { foo } from 'bar')
- Async work inside `useEffect`: declare a named inner function and call it (not an IIFE). Pass `AbortSignal` from a controller created in the effect, abort unconditionally in the cleanup, and ignore `AbortError` in the catch. Named functions show in stack traces; AbortController cancels the actual request instead of just discarding the response. See `src/client/hooks/useCompatibilityExtremes.ts` for the canonical shape. Extend `apiService` methods with an optional `signal?: AbortSignal` parameter as you touch them — don't retrofit all at once.
- Colour comes from the `letterboxd-*` tokens, never a raw Tailwind palette class (`text-red-400`, `bg-slate-800`). Raw colours bypass `src/client/__tests__/palette.contrast.test.ts`, which reads the tokens and gates every pairing — a colour it cannot see is a colour nothing checks. Enforced at `warn` by `no-restricted-syntax` in `src/client/eslint.config.mjs`; ~84 pre-existing violations are being burned down. New surfaces or text colours need a token, and the contrast test picks them up automatically.
- Accessibility lint (`eslint-plugin-jsx-a11y`) runs at **`error` across `**/*.tsx`** — every rule, every file, including tests and the e2e harness. There is no per-file promotion list: it enumerated what was protected rather than what wasn't, and an unmatched flat-config `files` pattern is silent, so a `git mv` dropped a file back to `warn` with nothing printed and a zero exit. If a rule genuinely cannot express a legitimate shape, widen its **options** for that file and keep the severity at `error` — `components/RatingDistributionHistogram.tsx` is the worked example. Never downgrade a file wholesale.
- Hover- or focus-revealed content is a **tooltip** or a **popover**, never both. A tooltip opens on hover and on *keyboard* focus, closes on pointer-leave, blur or Esc, and is never pinned by a click — gate the focus branch on `:focus-visible` so pointer-derived focus cannot latch it. A popover opens on activation, closes on activation again or Esc, and carries `aria-expanded`. WCAG 1.4.13 applies to both: Esc must dismiss without moving the pointer (a hovering user holds no focus, so that listener goes on `document`), and the pointer must be able to travel onto the panel — put the visual gap *inside* the panel wrapper as padding and make the panel a DOM descendant of its trigger, so neither geometry nor hit-testing interrupts the trip. `RatingDistributionHistogram.tsx` is the worked example; `src/client/e2e/histogram.spec.ts` is what proves it, because jsdom has no `:focus-visible` and no layout.
- A11y skills: for `.tsx` work involving interactive controls, forms, dialogs, focus management, or ARIA roles — including promoting `jsx-a11y` rules from `warn` to `error` — invoke the `fixing-accessibility` skill before editing. Use `accessibility` instead for a full-page WCAG 2.2 audit. Neither is vendored; install per machine with `npx skills add ibelick/ui-skills@fixing-accessibility -g -y` and `npx skills add addyosmani/web-quality-skills@accessibility -g -y`, and skip the step if they're absent rather than blocking. **Repo conventions outrank both**: their contrast advice doesn't know about the `letterboxd-*` tokens, and their "prefer established accessible primitives" guidance doesn't override an existing hand-rolled widget — fix it in place, don't pull in a component library.
- Comments: default to none. When an inline comment is warranted (non-obvious WHY only — workaround, hidden constraint, surprising invariant), keep it to ≤2 lines. **Hard ceiling: no more than 2 consecutive comment lines outside JSDoc** — a 3+-line non-JSDoc comment block is a policy violation, trim it. JSDoc on exported APIs is fine at any reasonable length since IDEs surface it on hover. Multi-paragraph narrative explanations belong in the PR description or commit body, not in source — they bloat files and rot in place. (A local, gitignored Stop hook can enforce this automatically — see `.claude/hooks/check-comment-blocks.mjs`; not committed, so set it up per machine.)

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

The **MFL** tables also have semantics the columns don't show:

- **`MFLFilms`** is the season's catalogue — every film available to pick, whether or not anyone picked it. Admin upload populates it; scraping never does. Deliberately **no FK to `Films`**: an MFL film may not be scraped yet, and `Films` carries a release year where MFL needs a full date. There is no season key, so rollover is a manual truncate.
- **`MFLUserPicks`** is the roster edge. Its two foreign keys behave differently on purpose — deleting a user cascades to their picks, but deleting a film somebody picked is **refused**, so correcting a mistyped slug can't silently wipe everyone's roster.
- **`MFLScoringTally`** holds one row per film per awarded metric, unique on that pair: a film can be awarded a given metric once. Both columns are `NOT NULL` so that uniqueness actually holds — Postgres treats repeated NULLs as distinct.

## API surface

Routes are defined under `src/server/routes/`. Quick map:

- `/api/auth` — signup / login / forgot-password (server-mediated). `GET /me` is JWT-authed and returns the account's identity joined with its linked Letterboxd profile (`{ id, email, role, lbusername, displayName }`); `lbusername` is null when unclaimed. It's how the client resolves the logged-in user's own lbusername (e.g. to link to their public `/user/:lbusername` page) — resolved by the `AuthProvider` context (`useAuth()`), the single owner of the token + `CurrentUser`.
- `/api/film-users` — **public, DB-only reads** of Letterboxd data. 404 on miss (hint user to trigger a refresh). No fallback scraping; the legacy `?fallback=scrape` query param was removed when Puppeteer was retired.
- `/api/films/:filmSlug` — public, DB-only read powering the `/film/:filmSlug` page. Aggregates (`watchedCount` / `ratedCount` / `averageRating`) and the rater list are scoped to `Users.is_discord = true` unless `?includeNonDiscord=true`; **existence is never scoped**, so a slug logged only by non-Discord users still returns 200 with zeroed stats and 404 means the slug is in neither `Films` nor `UserFilms`. "Rated" is `rating IS NOT NULL AND rating > 0` — `UserFilms.rating` uses 0 for unrated alongside NULL. Rate-limited 200 req / 5 min per IP.
- `/api/scrape-user` — **JWT-authed** per-user refresh job (trigger / poll / cancel). Delegates to moviemaestro. Per-username rate limit 10 req / 5 min; poll 120 req / 60s per IP.
- `/api/admin/refresh-rankings` — **admin only** bulk refresh, same delegation pattern.
- `/api/comparison` — public read endpoints powering the compare + hater-rankings pages.
- `/api/actor-graph` — public, **cache-through to TMDB** for the Six-Degrees feature:
  - `path-finder/:a1/:a2` — layer-by-layer BFS over `ag_acted_in` (one indexed self-join per layer, global visited map; O(V+E) over the connected component). Rate-limited tighter: 20 req / 5 min per IP.
  - `search?q=...` — merges DB hits (pg_trgm GIN, ILIKE wildcards `%`/`_`/`\` escaped) with TMDB `/search/person`+`/search/movie`. Either source degrades gracefully on the other's failure. `q` length clamped 2–80. Rate-limited 60 req / 5 min per IP.
  - `actors/:id`, `movies/:id`, `actors/:id/costars`, `actors/:a1/common-movies/:a2` — cache-through; ingestion rate-limited 120 req / 5 min per IP.
  - Public despite being cache-through writers: writes are bounded (top-15 cast per ingestion), source is TMDB (itself public), per-IP rate limiters cap abuse. Requires `TMDB_READ_API_TOKEN` (503 if unset).
- `/api/users` — JWT-protected CRUD for app accounts (admin-only for list/edit/delete of others).
- `/api/mfl` — Movie Fantasy League. The four reads are **public**; the two writes are **admin only** and live under `/mfl/admin/*` (`POST /admin/movie-score`, `DELETE /admin/movie-score/:scoringId`). Both write `MFLScoringTally` — a film's award of one scoring metric — despite the legacy "scoring metric" naming that survived until bpdiscord-ayy. Editing the metrics themselves is bpdiscord-s6t and does not exist yet.
- `/api/events` — public award-show/event reads plus `POST /picks` for any logged-in user; everything under `/events/admin/*` is admin only. The reference for how a mixed public/admin router applies middleware **per route** rather than via `router.use`.

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
- The page-level admin gate (`useAuth().user?.role === 'admin'`, sourced from `/me`) is **UX only**. The real gate is the server-side `authorizeAdmin` middleware.

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

**Test DB note**: smoke-seeded fixtures live in the same local Supabase instance the test suite uses. The suite tolerates that — every DB-backed test file resets what it touches — so the two can be run in either order. See `.claude/unit-tests.md` before changing test parallelism or a `beforeEach`.

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

### Resolving PR conflicts

**Never resolve a conflict in GitHub's web editor.** Merge locally instead:

```bash
git checkout <branch>
git merge origin/main   # resolve anything reported, then commit
git push
```

GitHub then sees the branch as mergeable.

This matters most for `.beads/issues.jsonl`. It is a generated export that `bd` rewrites on every command with unstable line order — the five `bd remember` memory records come out of a Go map, so their order changes on every single command while the issue records stay put. A **clean filter** canonicalises the file to sorted order so git never sees that churn, and a **merge driver** unions by record id so branches touching unrelated issues don't collide. The merge driver works **only locally**, because GitHub cannot run repo-supplied merge code. GitHub will still report the file as conflicted; ignore that and merge locally.

Resolving it by hand duplicates records. `main` was carrying a duplicated memory from an earlier hand-resolution. If you ever must, take either side and run `bd export --all -o .beads/issues.jsonl` — the local Dolt DB is the source of truth.

One-time per clone. Both are named by `.gitattributes`, and git **silently skips** either one when it isn't configured — an unconfigured clone commits unsorted exports and reintroduces the churn for everyone else:

```bash
git config merge.beads-jsonl.name "beads JSONL union merge"
git config merge.beads-jsonl.driver "node scripts/merge-beads-jsonl.mjs %O %A %B"
git config filter.beads-jsonl.clean "LC_ALL=C sort"
git config filter.beads-jsonl.smudge cat
```

The filter only changes what git stores; the working-tree file stays in whatever order `bd` last wrote. `git diff` on a file `bd` has just rewritten should be empty — if it isn't, check `git check-attr filter -- .beads/issues.jsonl` and the config above. `LC_ALL=C` is required: a locale-dependent sort is not the same canonical form on every machine.

### PR descriptions

**Hard ceiling: ~200 words.** A reviewer should get the shape of the change in about 30 seconds. Follow `.github/pull_request_template.md`.

- Lead with what changed and why. Tables over prose for anything enumerable.
- Include only what the diff cannot say: deviations from the ticket, decisions a reviewer would question, and findings that came out of the work.
- Cut process narration ("first I…, then I…"), restatements of the diff, and measurements that support a decision rather than being the decision.
- Detailed reasoning that doesn't fit goes in the **commit body**, not the description. The description is for reviewing; the commit body is for the archaeology later.
- **Keep it self-contained.** Describe the change on its own terms, so a reviewer needs nothing but the diff and the description. Don't name other issues, branches or PRs to carry the explanation — say "a later change drops this table", not the issue id. Cite one only when it is a real dependency a reviewer must act on, such as a PR that has to merge first. Issue ids belong in the title and the commit trailer, where they are already tracked.

The comment policy sends narrative out of source and into the PR. That is right, but the PR is not an unbounded destination — the same discipline applies.

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
3. Scan the diff for comment blocks >2 lines that restate code; delete them (a local Stop hook can automate this — see Code style)
4. Update issue status — close finished work, update in-progress items
5. **Push to remote** (mandatory):
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
6. Clean up — clear stashes, prune remote branches
7. Verify — all changes committed AND pushed
8. Hand off — provide context for next session

**Critical:** work is NOT complete until `git push` succeeds. If push fails, resolve and retry until it succeeds.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:ca08a54f -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

## Session Completion

**When ending a work session**, you MUST complete ALL steps below. Work is NOT complete until `git push` succeeds.

**MANDATORY WORKFLOW:**

1. **File issues for remaining work** - Create issues for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **PUSH TO REMOTE** - This is MANDATORY:
   ```bash
   git pull --rebase
   bd dolt push
   git push
   git status  # MUST show "up to date with origin"
   ```
5. **Clean up** - Clear stashes, prune remote branches
6. **Verify** - All changes committed AND pushed
7. **Hand off** - Provide context for next session

**CRITICAL RULES:**
- Work is NOT complete until `git push` succeeds
- NEVER stop before pushing - that leaves work stranded locally
- NEVER say "ready to push when you are" - YOU must push
- If push fails, resolve and retry until it succeeds
<!-- END BEADS INTEGRATION -->
