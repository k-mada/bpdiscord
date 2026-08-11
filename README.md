# BPDiscord

**[bpdiscord.vercel.app](https://bpdiscord.vercel.app)**

![CI](https://github.com/k-mada/bpdiscord/actions/workflows/ci.yml/badge.svg)

A full-stack TypeScript web app that turns the Letterboxd activity of the Big Picture Discord into something you can browse, compare, and argue about. Letterboxd data is scraped by a separate Python worker into Supabase Postgres; this app is a React 19 client and an Express API that read from it.

## What it does

Everything below is public unless noted. Reads are database-only — nothing in a page load hits Letterboxd.

<!-- screenshot: stats homepage -->

**Server stats (`/`)** — the landing page. Community-wide rating histogram, total films watched/rated, and leaderboards for highest rated (20+ ratings) and most watched films, filterable down to a single release year (5+ ratings at year scope).

**Film page (`/film/:filmSlug`)** — per-film view: watched count, rated count, average rating, and the list of members who rated it, with a distribution of how the group scored it. Stats are scoped to Discord members by default. A film that exists but has no Discord ratings still renders, with zeroed stats.

**User profile (`/user/:username`)** — a member's rating distribution, watched/rated totals, a link to their real Letterboxd profile, a quick "compare with" widget, and their compatibility extremes: the members whose taste is closest to and furthest from theirs.

<!-- screenshot: compare page -->

**Compare (`/compare`)** — head-to-head between any two members. Side-by-side rating distributions, films in common with both ratings, and a taste-compatibility score built on Pearson correlation and mean absolute difference over shared rated films (computed in SQL). The correlation is presented as a spectrum — Opposite / Independent / Aligned — and flagged as unreliable below 10 shared films, where a single film can flip the sign.

**Movie swap (`/movie-swap`)** — recommendation exchange between two members: films one has logged that the other hasn't, ranked by the rater's score, in both directions.

**Hater rankings (`/hater-rankings`)** — members ranked by average rating, lowest first, with distribution histograms and per-film rating differentials showing who runs hot and who runs cold relative to the group.

**Six degrees (`/actor-graph`)** — search actors and films, then find the shortest connection between two actors as a breadth-first search over a cached actor↔film graph. Data is pulled from TMDB on cache miss and persisted, so the graph deepens as people use it.

**Awards events (`/events`, `/events/:slug`)** — award-show pick'em. Browse an event's categories and nominees, see everyone's picks against the actual winners, and submit your own at `/events/:slug/my-picks` (login required). Admins manage shows, events, categories, nominees, and winners at `/events/admin`.

**Oscar predictions (`/oscars-2026`)** — Sean and Amanda's will-win / should-win picks by category, scored against announced winners.

**Movie Fantasy League (`/mfl`)** — point breakdowns for a film under the league's scoring metrics (box office, rankings, nominations, wins), with the full rulebook at `/mfl/scoring-reference` and admin scoring tools at `/mfl/admin`.

**Accounts and refresh** — signup, login, and password reset (`/login`, `/signup`, `/forgot-password`, `/reset-password`). The data fetcher at `/fetcher` inspects what the database holds for a user and triggers a fresh scrape of one profile's ratings and films, with live job progress. Admins get a bulk re-scrape of every user at `/dashboard/refresh-films` and account administration at `/admin/users`.

## How it works

**Reads are database-first.** Every client-facing endpoint is a Postgres query. There is no Puppeteer, no Cheerio, and no synchronous call to Letterboxd anywhere in a request. A missing user or film returns 404 with a hint to run a refresh.

**Writes are delegated.** Scraping runs in **moviemaestro**, a separate Python worker on Railway. A refresh inserts a job row, hands the job to the worker, and returns `202 {job_id}`; the client polls until the job reaches a terminal state. The worker writes results straight to Supabase.

**One exception: TMDB cache-through.** `/api/actor-graph` writes on cache miss, bounded per request and rate-limited per IP.

## API surface

| Route | Access | Purpose |
| --- | --- | --- |
| `/api/auth` | mixed | signup / login / forgot-password; `GET /me` returns the account joined with its linked Letterboxd profile |
| `/api/stats` | public | community aggregates: rating distribution, film counts, top films by year |
| `/api/films/:filmSlug` | public | film page data — aggregates and rater list |
| `/api/film-users` | public | member profiles and ratings, DB-only |
| `/api/comparison` | public | compare, movies in common, movie swap, compatibility extremes, hater rankings |
| `/api/actor-graph` | public | actor/film search, path-finder BFS, co-stars, common movies (cache-through to TMDB) |
| `/api/events` | mixed | award shows, events, nominees; picks require auth, management requires admin |
| `/api/mfl` | mixed | fantasy-league scoring metrics and per-film scores |
| `/api/scrape-user` | JWT | trigger / poll / cancel a per-user refresh job |
| `/api/admin`, `/api/admin/users` | admin | bulk refresh and app-account CRUD |

Everything under `/api/` is rate-limited; scraping, search, and path-finding have tighter per-IP limits than plain reads.

## Getting started

Requires Node 18+ (CI runs 20), Yarn 4 via corepack (`corepack enable`), and a Supabase project.

```bash
yarn install:all
yarn dev          # PROD Supabase — the normal workflow, with real data
yarn dev:local    # LOCAL Supabase — smoke environment with fixtures
```

Server on `http://localhost:3001`, client on `http://localhost:5173` (Vite proxies `/api` to the server). A startup breadcrumb prints which database you're pointed at.

Environment templates live in `src/server/` and `src/client/` — copy each `.env.example` to `.env` and fill it in. Never commit a filled-in `.env`.

For local smoke testing against a local Supabase stack, run `supabase start` then `yarn setup:local`, which writes `.env.smoke` files and seeds an admin plus fixture users, films, and ratings. See CLAUDE.md for the details and known limitations.

## Development

```bash
yarn build                      # compile the server; yarn build:client for the client
yarn lint                       # eslint + tsc --noEmit across both workspaces
cd src/client && yarn test      # vitest
cd src/server && yarn test      # vitest — needs a local Supabase running
```

Server tests hit a live Postgres and share one database with the smoke fixtures, so run them before `yarn setup:local` for a clean pass. CI gates lint on both workspaces plus the client test suite; server tests stay a local-only gate until they're isolated.

Database changes land as timestamped SQL files in `supabase/migrations/`. Drizzle's `src/server/db/schema.ts` gives the query builder its types but is **not** part of the deploy pipeline — the SQL migration is the source of truth.

Issues are tracked with beads (`bd`) in `.beads/`, not GitHub Issues. All changes reach `main` through a pull request from a feature branch.

## Deployment

Vercel, from `vercel.json` — the Express server builds as a serverless function and the Vite client as a static build, with `/api/*` routed to the former and everything else to the client's `index.html`. Production needs the same environment variables as local development, set in the Vercel dashboard.

Migrations deploy separately: a push to `main` touching `supabase/migrations/**` triggers `.github/workflows/migrations.yml`, which plans the migration and then waits on manual approval in the `production` GitHub environment before applying it.

## Tech stack

React 19, Vite, Tailwind CSS 4, React Router on the client. Express 4, TypeScript, Drizzle ORM, Helmet, and express-rate-limit on the server. Supabase (Postgres + Auth) for data and JWT-based auth, with `pg_trgm` powering actor/film search. TMDB supplies actor-graph data; moviemaestro supplies Letterboxd data.

## Documentation

- **[CLAUDE.md](./CLAUDE.md)** — architecture details, schema gotchas, workflow conventions
- **[AGENTS.md](./AGENTS.md)** — agent-facing conventions for this repo

## License and attribution

MIT — see [LICENSE](./LICENSE).

This is an unofficial fan project, not affiliated with or endorsed by Letterboxd. Actor and film metadata comes from [TMDB](https://www.themoviedb.org/); this product uses the TMDB API but is not endorsed or certified by TMDB.
