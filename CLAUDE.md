# Other md files

.claude/unit-tests.md
.claude/react.md
.claude/tailwind.md
.claude/typescript.md
.claude/puppeteer.md
.claude/security.md

# Code style

- Use ES modules (import/export) syntax, not commonJS (require)
- Destructure imports when possible (e.g. import { foo } from 'bar')
-

# BPDiscord

Full-stack TypeScript app that scrapes and analyzes Letterboxd user rating data. Features user comparisons, hater rankings, award show predictions, and a Movie Fantasy League.

## Tech Stack

- **Frontend**: Vite + React 18 + TypeScript, Tailwind CSS
- **Backend**: Express.js + TypeScript
- **Database**: Supabase (PostgreSQL)
- **Authentication**: JWT tokens via Supabase Auth
- **Web Scraping**: Puppeteer + Cheerio
- **Testing**: Vitest (both client and server)
- **Package Manager**: Yarn

## Project Structure

```
bpdiscord/
├── src/
│   ├── client/               # Vite + React frontend
│   │   ├── components/       # React components
│   │   │   ├── events/       # Award show prediction components
│   │   │   ├── oscars/       # Oscars-specific components
│   │   │   └── MovieFantasyLeague/
│   │   ├── hooks/            # Custom React hooks
│   │   ├── services/         # API client services
│   │   ├── __tests__/        # Client unit tests
│   │   └── types.ts
│   ├── server/               # Express.js backend
│   │   ├── controllers/      # Business logic
│   │   ├── routes/           # API route definitions
│   │   ├── middleware/        # Auth, validation, error handling
│   │   ├── config/           # Database configuration
│   │   └── __tests__/        # Server unit tests
│   └── shared/               # Shared utilities (used by both client and server)
│       ├── utilities.ts      # Star rating parsing, shared helpers
│       └── testFixtures/     # Shared test data
├── vercel.json
└── yarn.lock
```

## API Endpoints

### Auth (`/api/auth`) — Public

- `POST /signup`, `/login`, `/forgot-password`, `/reset-password`

### Film Users (`/api/film-users`) — Public, database-first

- `GET /`, `/:username/ratings`, `/:username/profile`, `/:username/complete`, `/:username/films`
- Add `?fallback=scrape` to trigger scraping if data is missing

### Comparison (`/api/comparison`) — Public

- `GET /usernames`, `/hater-rankings`, `/v2/hater-rankings`
- `POST /user-ratings`, `/compare`, `/movies-in-common`, `/movie-swap`

### Events (`/api/events`) — Mixed auth

- `GET /award-shows`, `/:slug`, `/:slug/my-picks`
- `POST /picks`, admin endpoints for categories/nominees/winners (protected)

### Scraper (`/api/scraper`) — Protected, disabled in prod unless `ENABLE_SCRAPER=true`

- `POST /getUserRatings`, `/getUserProfile`, `/getAllFilms`, `/getData`
- `GET /film/:filmSlug/ratings`, `/stream-films/:username`, `/update-lb-films/:username`

### Stats (`/api/stats`) — Public

- `GET /total-ratings`, `/all-user-films`, `/user-films-count`, `/get-missing-films`

### Movie Fantasy League (`/api/mfl`) — Mixed auth

- `GET /scoring-metrics`, `/user-scores/:username`, `/movie-score/:filmSlug`, `/movies`
- `POST /upsert-movie-score`, `DELETE /delete-scoring-metric/:scoringId`

### Cron (`/api/cron`) — Protected by cron secret

- `POST /refresh-all-users`, `/refresh-user/:username`

### Users (`/api/users`) — Protected

- `GET /`, `/me`, `/:id` — `PUT /:id` — `DELETE /:id`

## Architecture Notes

- **Database-first**: `/api/film-users` reads from DB; `/api/scraper` force-scrapes (protected + disabled in prod by default)
- **Shared code**: Put utilities used by both client and server in `src/shared/`
- **Vercel deployment**: Root `build` script compiles server only (`cd src/server && tsc`); Vercel handles client build separately via `@vercel/static-build`

## Development

```bash
yarn install:all   # Install all dependencies
yarn dev           # Start server + client concurrently
yarn dev:server    # Server only
yarn dev:client    # Client only
yarn build         # Build server for production
```

## Testing

```bash
# From src/server/ or src/client/
yarn test:lite     # Run tests (no coverage)
yarn test          # Run tests with coverage
yarn test:watch    # Watch mode
```

## Environment Variables

```bash
# src/server/.env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
JWT_SECRET=
NODE_ENV=development
ENABLE_SCRAPER=true   # Required to enable scraping endpoints in production

# src/client/.env
VITE_HOT_RELOAD=true
```

## Guidelines for working

- Always push back on ideas, rigorously to make sure it's the best one
