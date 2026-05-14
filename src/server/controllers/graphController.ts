import { Request, Response } from "express";
import axios, { AxiosError, AxiosInstance } from "axios";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { agActors, agFilms, agActedIn } from "../db/schema";
import { ApiResponse } from "../../shared/types";

// ===========================
// Path-finder tuning
// ===========================

const DEFAULT_MAX_DEPTH = 8;
const MAX_ALLOWED_DEPTH = 8;

// Only consider the top-N billed cast members when expanding a movie's
// co-stars. Real movies often have hundreds of credited actors (extras,
// voice roles, etc.); without a cutoff the branching factor makes the
// recursive CTE explode. 15 keeps the primary cast while trimming the
// long tail.
const DEFAULT_BILLING_CUTOFF = 15;
const MAX_BILLING_CUTOFF = 50;

// Hard ceiling on how long the path-finding query may run. Prevents a
// single bad pair (e.g. two obscure actors with no short path) from
// pinning a pooled connection.
const QUERY_TIMEOUT_MS = 5_000;

// Mirrors the Python ingestion service — when hydrating a movie's cast,
// only persist the top-N billed actors to keep the graph manageable.
const MAX_CAST_PER_MOVIE = 15;

// Co-stars can balloon for prolific actors (Kevin Bacon has ~1500+). Cap
// the response by default and let callers paginate via ?limit up to a
// hard ceiling.
const DEFAULT_COSTARS_LIMIT = 100;
const MAX_COSTARS_LIMIT = 500;

// Cap on the `q` parameter for /search. Prevents abusive payloads from
// being forwarded to TMDB or used as trigram patterns. Real actor /
// movie names fit comfortably under this.
const MAX_SEARCH_QUERY_LENGTH = 80;

// ===========================
// TMDB client
// ===========================

const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE = "https://image.tmdb.org/t/p";

let tmdbClient: AxiosInstance | null = null;

const getTmdbClient = (): AxiosInstance => {
  if (tmdbClient) return tmdbClient;
  const token = process.env.TMDB_READ_API_TOKEN;
  if (!token) {
    throw new TmdbUnavailableError("TMDB_READ_API_TOKEN is not configured");
  }
  tmdbClient = axios.create({
    baseURL: TMDB_BASE_URL,
    headers: { Authorization: `Bearer ${token}` },
    timeout: 5_000,
  });
  return tmdbClient;
};

class TmdbUnavailableError extends Error {}
class TmdbNotFoundError extends Error {}

const posterUrl = (path: string | null | undefined, size = "w342") =>
  path ? `${TMDB_IMAGE_BASE}/${size}${path}` : null;

const tmdbGet = async <T>(
  path: string,
  params: Record<string, unknown> = {},
): Promise<T> => {
  try {
    const resp = await getTmdbClient().get<T>(path, { params });
    return resp.data;
  } catch (err) {
    if (err instanceof AxiosError && err.response?.status === 404) {
      throw new TmdbNotFoundError(`TMDB resource not found: ${path}`);
    }
    throw err;
  }
};

// ===========================
// TMDB response shapes (subset we use)
// ===========================

type TmdbPersonResponse = {
  id: number;
  name: string;
  profile_path: string | null;
  popularity: number | null;
  birthday: string | null;
  biography: string | null;
  place_of_birth: string | null;
  movie_credits?: {
    cast?: Array<{
      id: number;
      title?: string;
      release_date?: string;
      poster_path?: string | null;
      overview?: string | null;
      popularity?: number | null;
      vote_average?: number | null;
      character?: string | null;
      order?: number | null;
    }>;
  };
};

type TmdbMovieResponse = {
  id: number;
  title: string;
  release_date: string | null;
  poster_path: string | null;
  overview: string | null;
  popularity: number | null;
  vote_average: number | null;
  genres?: Array<{ id: number; name: string }>;
  credits?: {
    cast?: Array<{
      id: number;
      name: string;
      profile_path: string | null;
      popularity: number | null;
      character: string | null;
      order: number | null;
    }>;
  };
};

type TmdbPersonSearchResponse = {
  results: Array<{
    id: number;
    name: string;
    profile_path: string | null;
    popularity: number | null;
  }>;
};

type TmdbMovieSearchResponse = {
  results: Array<{
    id: number;
    title: string;
    poster_path: string | null;
    release_date: string | null;
    popularity: number | null;
  }>;
};

// ===========================
// Input validation
// ===========================

const parsePositiveInt = (value: string | undefined): number | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  const n = Number.parseInt(trimmed, 10);
  return Number.isInteger(n) && n > 0 && String(n) === trimmed ? n : null;
};

const parseBoundedInt = (
  value: unknown,
  { min, max }: { min: number; max: number },
): number | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const n = Number.parseInt(trimmed, 10);
  // Reject non-canonical inputs ("05", " 5", "5abc") — `String(n) === trimmed`
  // mirrors parsePositiveInt so path params and query params validate the
  // same way.
  if (!Number.isInteger(n) || n < min || n > max || String(n) !== trimmed) {
    return null;
  }
  return n;
};

// Escape characters that LIKE/ILIKE treats as wildcards. PG's default
// escape character is `\`, which we must escape too. Without this, a user
// query containing `%` or `_` matches everything / any-single-char and
// degrades trigram index utilisation. Not a SQL-injection concern (Drizzle
// parameterizes), but a search-quality + performance concern.
const escapeLikePattern = (s: string): string =>
  s.replace(/[\\%_]/g, (c) => `\\${c}`);

const extractReleaseYear = (
  releaseDate: string | null | undefined,
): number | null => {
  if (!releaseDate || releaseDate.length < 4) return null;
  const year = Number.parseInt(releaseDate.slice(0, 4), 10);
  return Number.isInteger(year) ? year : null;
};

const dedupeBy = <T, K>(items: T[], key: (item: T) => K): T[] => {
  const seen = new Set<K>();
  const out: T[] = [];
  for (const item of items) {
    const k = key(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
};

// DB rows win over TMDB rows on id collision (we already have richer data
// for them). Results are ordered by popularity desc and capped to `limit`.
const mergeAndRank = <T extends { tmdbId: number; popularity: number | null }>(
  dbRows: T[],
  tmdbRows: T[],
  limit: number,
): T[] => {
  const dbIds = new Set(dbRows.map((r) => r.tmdbId));
  return [...dbRows, ...tmdbRows.filter((r) => !dbIds.has(r.tmdbId))]
    .sort((a, b) => (b.popularity ?? 0) - (a.popularity ?? 0))
    .slice(0, limit);
};

// ===========================
// Cache-through ingestion helpers
// ===========================

type ActorRow = typeof agActors.$inferSelect;
type FilmRow = typeof agFilms.$inferSelect;

// In-process request coalescing. When two concurrent requests ask for the
// same actor/movie, the second finds an in-flight promise and awaits it
// instead of firing its own TMDB call + transaction. Saves TMDB quota and
// avoids redundant writes within a single Node instance. Cross-instance
// races (Vercel parallel lambdas) still fall through to ON CONFLICT DO
// UPDATE — bounded cost, no correctness impact.
const inflightActor = new Map<number, Promise<ActorRow | null>>();
const inflightMovie = new Map<number, Promise<MovieWithCast | null>>();

function coalesce<K, V>(
  map: Map<K, Promise<V>>,
  key: K,
  fn: () => Promise<V>,
): Promise<V> {
  const existing = map.get(key);
  if (existing) return existing;
  const promise = fn().finally(() => map.delete(key));
  map.set(key, promise);
  return promise;
}

/**
 * Guarantees an actor and their filmography are stored. If the actor row
 * is missing or not fully fetched, pulls /person/:id?append_to_response=
 * movie_credits from TMDB and persists actor + lightweight film nodes +
 * edges in a single transaction.
 */
export function ensureActor(tmdbId: number): Promise<ActorRow | null> {
  return coalesce(inflightActor, tmdbId, () => ensureActorImpl(tmdbId));
}

async function ensureActorImpl(tmdbId: number): Promise<ActorRow | null> {
  const existing = await db
    .select()
    .from(agActors)
    .where(eq(agActors.tmdbId, tmdbId))
    .limit(1);

  if (existing[0]?.fullyFetched) {
    return existing[0];
  }

  const person = await tmdbGet<TmdbPersonResponse>(`/person/${tmdbId}`, {
    append_to_response: "movie_credits",
  });

  const rawCredits = person.movie_credits?.cast ?? [];
  // Skip credits missing a usable id or title — ag_films.title is NOT NULL,
  // so inserting "" would pollute search and downstream joins. TMDB
  // occasionally returns region-blocked or unreleased rows without a title.
  const credits = dedupeBy(
    rawCredits.filter(
      (c) =>
        Number.isInteger(c.id) &&
        typeof c.title === "string" &&
        c.title.trim().length > 0,
    ),
    (c) => c.id,
  );

  const now = new Date();
  const actorRow = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(agActors)
      .values({
        tmdbId: person.id,
        name: person.name,
        profilePath: person.profile_path,
        popularity: person.popularity ?? null,
        birthday: person.birthday,
        biography: person.biography,
        placeOfBirth: person.place_of_birth,
        fullyFetched: true,
        fetchedAt: now,
      })
      .onConflictDoUpdate({
        target: agActors.tmdbId,
        set: {
          name: sql`excluded.name`,
          profilePath: sql`excluded.profile_path`,
          popularity: sql`excluded.popularity`,
          birthday: sql`excluded.birthday`,
          biography: sql`excluded.biography`,
          placeOfBirth: sql`excluded.place_of_birth`,
          fullyFetched: sql`true`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      })
      .returning();

    if (credits.length === 0) return inserted[0] ?? null;

    // Lightweight film upserts — do not flip cast_fully_fetched.
    const filmRows = credits.map((c) => {
      const releaseDate = c.release_date ?? null;
      return {
        tmdbId: c.id,
        title: c.title as string,
        releaseDate,
        releaseYear: extractReleaseYear(releaseDate),
        posterPath: c.poster_path ?? null,
        posterUrl: posterUrl(c.poster_path),
        overview: c.overview ?? null,
        popularity: c.popularity ?? null,
        voteAverage: c.vote_average ?? null,
        fetchedAt: now,
      };
    });

    await tx
      .insert(agFilms)
      .values(filmRows)
      .onConflictDoUpdate({
        target: agFilms.tmdbId,
        set: {
          // Only refresh fields that are cheap to refresh — don't touch
          // cast_fully_fetched; that's owned by ensureMovieWithCast.
          title: sql`excluded.title`,
          releaseDate: sql`excluded.release_date`,
          releaseYear: sql`excluded.release_year`,
          posterPath: sql`excluded.poster_path`,
          posterUrl: sql`excluded.poster_url`,
          overview: sql`COALESCE(excluded.overview, ${agFilms.overview})`,
          popularity: sql`excluded.popularity`,
          voteAverage: sql`excluded.vote_average`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      });

    const edgeRows = credits.map((c) => ({
      actorTmdbId: person.id,
      movieTmdbId: c.id,
      character: c.character ?? null,
      billingOrder: c.order ?? null,
    }));

    await tx
      .insert(agActedIn)
      .values(edgeRows)
      .onConflictDoUpdate({
        target: [agActedIn.actorTmdbId, agActedIn.movieTmdbId],
        set: {
          character: sql`excluded.character`,
          billingOrder: sql`excluded.billing_order`,
        },
      });

    return inserted[0] ?? null;
  });

  return actorRow;
}

type MovieWithCast = FilmRow & {
  cast: Array<{
    tmdbId: number;
    name: string;
    profilePath: string | null;
    character: string | null;
    billingOrder: number | null;
  }>;
};

/**
 * Guarantees a film and its principal cast are stored. If the film is
 * missing or its cast hasn't been fully fetched yet, pulls
 * /movie/:id?append_to_response=credits, trims to MAX_CAST_PER_MOVIE by
 * billing order, and upserts everything in one transaction. Lightweight
 * actor rows created here never clobber a prior fully_fetched=true.
 */
export function ensureMovieWithCast(tmdbId: number): Promise<MovieWithCast | null> {
  return coalesce(inflightMovie, tmdbId, () => ensureMovieWithCastImpl(tmdbId));
}

async function ensureMovieWithCastImpl(
  tmdbId: number,
): Promise<MovieWithCast | null> {
  const existing = await db
    .select()
    .from(agFilms)
    .where(eq(agFilms.tmdbId, tmdbId))
    .limit(1);

  // Cache hit: pull cast inline (one join) and return. Skip the extra
  // film re-SELECT that dbGetMovieWithCast would do — we already have the
  // row in `existing`.
  if (existing[0]?.castFullyFetched) {
    const cast = await db
      .select({
        tmdbId: agActors.tmdbId,
        name: agActors.name,
        profilePath: agActors.profilePath,
        character: agActedIn.character,
        billingOrder: agActedIn.billingOrder,
      })
      .from(agActedIn)
      .innerJoin(agActors, eq(agActors.tmdbId, agActedIn.actorTmdbId))
      .where(eq(agActedIn.movieTmdbId, tmdbId))
      .orderBy(sql`${agActedIn.billingOrder} ASC NULLS LAST`);

    return { ...existing[0], cast };
  }

  const movie = await tmdbGet<TmdbMovieResponse>(`/movie/${tmdbId}`, {
    append_to_response: "credits",
  });

  const rawCast = movie.credits?.cast ?? [];
  const trimmed = dedupeBy(
    rawCast
      .filter(
        (c) =>
          Number.isInteger(c.id) &&
          typeof c.name === "string" &&
          c.name.length > 0,
      )
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
    (c) => c.id,
  ).slice(0, MAX_CAST_PER_MOVIE);

  const releaseDate = movie.release_date;
  const genres = (movie.genres ?? []).map((g) => g.name);
  const now = new Date();

  const filmRow = await db.transaction(async (tx) => {
    const insertedFilm = await tx
      .insert(agFilms)
      .values({
        tmdbId: movie.id,
        title: movie.title,
        releaseDate,
        releaseYear: extractReleaseYear(releaseDate),
        posterPath: movie.poster_path,
        posterUrl: posterUrl(movie.poster_path),
        overview: movie.overview,
        popularity: movie.popularity ?? null,
        voteAverage: movie.vote_average ?? null,
        genres,
        castFullyFetched: true,
        fetchedAt: now,
      })
      .onConflictDoUpdate({
        target: agFilms.tmdbId,
        set: {
          title: sql`excluded.title`,
          releaseDate: sql`excluded.release_date`,
          releaseYear: sql`excluded.release_year`,
          posterPath: sql`excluded.poster_path`,
          posterUrl: sql`excluded.poster_url`,
          overview: sql`excluded.overview`,
          popularity: sql`excluded.popularity`,
          voteAverage: sql`excluded.vote_average`,
          genres: sql`excluded.genres`,
          castFullyFetched: sql`true`,
          fetchedAt: sql`excluded.fetched_at`,
        },
      })
      .returning();

    if (trimmed.length > 0) {
      const actorRows = trimmed.map((m) => ({
        tmdbId: m.id,
        name: m.name,
        profilePath: m.profile_path,
        popularity: m.popularity ?? null,
        fullyFetched: false,
        fetchedAt: now,
      }));

      // Lightweight actor upsert — never clobber a prior
      // fully_fetched=true. ON CONFLICT for existing rows only refreshes
      // surface metadata.
      await tx
        .insert(agActors)
        .values(actorRows)
        .onConflictDoUpdate({
          target: agActors.tmdbId,
          set: {
            name: sql`excluded.name`,
            profilePath: sql`excluded.profile_path`,
            popularity: sql`excluded.popularity`,
          },
        });

      const edgeRows = trimmed.map((m) => ({
        actorTmdbId: m.id,
        movieTmdbId: movie.id,
        character: m.character,
        billingOrder: m.order,
      }));

      await tx
        .insert(agActedIn)
        .values(edgeRows)
        .onConflictDoUpdate({
          target: [agActedIn.actorTmdbId, agActedIn.movieTmdbId],
          set: {
            character: sql`excluded.character`,
            billingOrder: sql`excluded.billing_order`,
          },
        });
    }

    return insertedFilm[0] ?? null;
  });

  if (!filmRow) return null;

  // Build the cast response from the in-memory trimmed array — no re-read
  // needed. Ordering matches the inline cast JOIN above (billing order ASC
  // NULLS LAST), which is how we pre-sorted `trimmed`.
  const cast = trimmed.map((m) => ({
    tmdbId: m.id,
    name: m.name,
    profilePath: m.profile_path,
    character: m.character,
    billingOrder: m.order,
  }));

  return { ...filmRow, cast };
}

// ===========================
// Read-only DB queries
// ===========================

type CostarRow = {
  tmdbId: number;
  name: string;
  profilePath: string | null;
  movieCount: number;
  sharedMovies: string[];
};

// Helpers in this controller throw on DB error rather than returning
// `dbOperation`'s `{success, data, error}` shape. Reason: handlers in this
// file already use `classifyError` to convert thrown errors (TMDB-specific
// + generic) into HTTP responses; layering `dbOperation` on top creates a
// second error path for the same flow. Other controllers (dataController,
// eventDataController) don't have classifyError and keep `dbOperation`.
//
// SQL `AS "camelCase"` aliases use double quotes so PG preserves case
// (unquoted identifiers are folded to lowercase). This keeps response
// keys camelCase to match the rest of the API surface.
async function dbGetCostars(
  actorTmdbId: number,
  limit: number,
): Promise<CostarRow[]> {
  return db.execute<CostarRow>(sql`
    SELECT
      co.tmdb_id           AS "tmdbId",
      co.name              AS "name",
      co.profile_path      AS "profilePath",
      COUNT(DISTINCT f.tmdb_id)::int AS "movieCount",
      ARRAY_AGG(DISTINCT f.title)    AS "sharedMovies"
    FROM ag_acted_in me
    JOIN ag_acted_in them
      ON them.movie_tmdb_id = me.movie_tmdb_id
     AND them.actor_tmdb_id <> me.actor_tmdb_id
    JOIN ag_actors co ON co.tmdb_id = them.actor_tmdb_id
    JOIN ag_films f ON f.tmdb_id = me.movie_tmdb_id
    WHERE me.actor_tmdb_id = ${actorTmdbId}
    GROUP BY co.tmdb_id, co.name, co.profile_path, co.popularity
    ORDER BY "movieCount" DESC, co.popularity DESC NULLS LAST
    LIMIT ${limit}
  `);
}

type CommonMovieRow = {
  tmdbId: number;
  title: string;
  releaseDate: string | null;
  releaseYear: number | null;
  posterPath: string | null;
  posterUrl: string | null;
  voteAverage: number | null;
  actor1Character: string | null;
  actor2Character: string | null;
};

async function dbGetCommonMovies(
  actor1Id: number,
  actor2Id: number,
): Promise<CommonMovieRow[]> {
  return db.execute<CommonMovieRow>(sql`
    SELECT
      f.tmdb_id      AS "tmdbId",
      f.title        AS "title",
      f.release_date AS "releaseDate",
      f.release_year AS "releaseYear",
      f.poster_path  AS "posterPath",
      f.poster_url   AS "posterUrl",
      f.vote_average AS "voteAverage",
      ai1.character  AS "actor1Character",
      ai2.character  AS "actor2Character"
    FROM ag_acted_in ai1
    JOIN ag_acted_in ai2
      ON ai2.movie_tmdb_id = ai1.movie_tmdb_id
    JOIN ag_films f ON f.tmdb_id = ai1.movie_tmdb_id
    WHERE ai1.actor_tmdb_id = ${actor1Id}
      AND ai2.actor_tmdb_id = ${actor2Id}
    ORDER BY f.release_date DESC NULLS LAST
  `);
}

type ActorSearchRow = {
  tmdbId: number;
  name: string;
  profilePath: string | null;
  popularity: number | null;
};

type MovieSearchRow = {
  tmdbId: number;
  title: string;
  posterPath: string | null;
  posterUrl: string | null;
  releaseYear: number | null;
  popularity: number | null;
};

async function dbSearchActors(
  query: string,
  limit = 10,
): Promise<ActorSearchRow[]> {
  const pattern = `%${escapeLikePattern(query)}%`;
  return db
    .select({
      tmdbId: agActors.tmdbId,
      name: agActors.name,
      profilePath: agActors.profilePath,
      popularity: agActors.popularity,
    })
    .from(agActors)
    .where(sql`${agActors.name} ILIKE ${pattern} ESCAPE '\\'`)
    .orderBy(desc(sql`COALESCE(${agActors.popularity}, 0)`))
    .limit(limit);
}

async function dbSearchMovies(
  query: string,
  limit = 10,
): Promise<MovieSearchRow[]> {
  const pattern = `%${escapeLikePattern(query)}%`;
  return db
    .select({
      tmdbId: agFilms.tmdbId,
      title: agFilms.title,
      posterPath: agFilms.posterPath,
      posterUrl: agFilms.posterUrl,
      releaseYear: agFilms.releaseYear,
      popularity: agFilms.popularity,
    })
    .from(agFilms)
    .where(sql`${agFilms.title} ILIKE ${pattern} ESCAPE '\\'`)
    .orderBy(desc(sql`COALESCE(${agFilms.popularity}, 0)`))
    .limit(limit);
}

// ===========================
// Error handling
// ===========================

type HandlerError = { status: number; body: ApiResponse };

function classifyError(error: unknown, context: string): HandlerError {
  if (error instanceof TmdbNotFoundError) {
    return { status: 404, body: { error: "Not found" } };
  }
  if (error instanceof TmdbUnavailableError) {
    return {
      status: 503,
      body: {
        error: "TMDB integration not configured",
        message: error.message,
      },
    };
  }
  if (error instanceof AxiosError) {
    const upstream = error.response?.status;
    if (upstream === 429) {
      return { status: 429, body: { error: "Upstream rate limit (TMDB)" } };
    }
    return {
      status: 502,
      body: {
        error: "TMDB request failed",
        details: { upstreamStatus: upstream ?? null },
      },
    };
  }
  console.error(`Error in ${context}:`, error);
  return {
    status: 500,
    body: {
      error: `Failed to ${context}`,
      ...(process.env.NODE_ENV !== "production" && {
        details: error instanceof Error ? error.message : undefined,
      }),
    },
  };
}

// ===========================
// Handlers
// ===========================

export async function findActorPath(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  const actor1Id = parsePositiveInt(req.params.actor1Id);
  const actor2Id = parsePositiveInt(req.params.actor2Id);

  if (actor1Id === null || actor2Id === null) {
    res.status(400).json({
      error: "Both actor ids must be positive integers",
    });
    return;
  }

  let maxDepth = DEFAULT_MAX_DEPTH;
  if (req.query.maxDepth !== undefined) {
    const parsed = parseBoundedInt(req.query.maxDepth, {
      min: 1,
      max: MAX_ALLOWED_DEPTH,
    });
    if (parsed === null) {
      res.status(400).json({
        error: `maxDepth must be an integer between 1 and ${MAX_ALLOWED_DEPTH}`,
      });
      return;
    }
    maxDepth = parsed;
  }

  let billingCutoff = DEFAULT_BILLING_CUTOFF;
  if (req.query.billingCutoff !== undefined) {
    const parsed = parseBoundedInt(req.query.billingCutoff, {
      min: 1,
      max: MAX_BILLING_CUTOFF,
    });
    if (parsed === null) {
      res.status(400).json({
        error: `billingCutoff must be an integer between 1 and ${MAX_BILLING_CUTOFF}`,
      });
      return;
    }
    billingCutoff = parsed;
  }

  try {
    // Cache-through ingestion: ensure both actors exist (populate from TMDB if missing).
    // This aligns with the pattern used by getCostars and getCommonMovies, and lets us
    // distinguish "unknown actor" (ensureActor returns null) from "no path within maxDepth".
    const [actor1, actor2] = await Promise.all([
      ensureActor(actor1Id),
      ensureActor(actor2Id),
    ]);

    if (!actor1 || !actor2) {
      const missing = [actor1Id, actor2Id].filter((_, idx) =>
        idx === 0 ? !actor1 : !actor2,
      );
      res.status(404).json({
        error: "Actor not found",
        details: { missing },
      });
      return;
    }

    // Layer-by-layer BFS over the actor co-appearance graph. The `parents`
    // map doubles as the global visited set (membership check) and the
    // parent-pointer chain (path reconstruction). Each actor is expanded
    // at most once, so complexity is O(V + E) over the connected component
    // — not O(B^D) like a recursive CTE that only dedupes within a single
    // path. One indexed lookup per layer:
    //   - my_cast: (actor_tmdb_id, movie_tmdb_id) — primary key
    //   - co_cast: (movie_tmdb_id, actor_tmdb_id) — idx_ag_acted_in_movie_actor
    type FrontierRow = {
      nextActor: number;
      prevActor: number;
      viaMovie: number;
    };

    const parents = new Map<number, { prev: number; movie: number } | null>();
    parents.set(actor1Id, null);

    let frontier: number[] = [actor1Id];
    let foundDepth: number | null = actor1Id === actor2Id ? 0 : null;

    if (foundDepth === null) {
      await db.transaction(async (tx) => {
        await tx.execute(
          sql.raw(`SET LOCAL statement_timeout = ${QUERY_TIMEOUT_MS}`),
        );

        for (let depth = 1; depth <= maxDepth; depth++) {
          if (frontier.length === 0) break;

          const frontierList = sql.join(
            frontier.map((id) => sql`${id}`),
            sql`, `,
          );

          // DISTINCT ON dedupes when a new actor is reachable through
          // several frontier actors in this same layer; we keep one
          // arbitrary parent edge.
          const rows = await tx.execute<FrontierRow>(sql`
            SELECT DISTINCT ON (co_cast.actor_tmdb_id)
              co_cast.actor_tmdb_id AS "nextActor",
              my_cast.actor_tmdb_id AS "prevActor",
              my_cast.movie_tmdb_id AS "viaMovie"
            FROM ag_acted_in my_cast
            JOIN ag_acted_in co_cast
              ON co_cast.movie_tmdb_id = my_cast.movie_tmdb_id
             AND co_cast.actor_tmdb_id <> my_cast.actor_tmdb_id
            WHERE my_cast.actor_tmdb_id IN (${frontierList})
              AND (my_cast.billing_order IS NULL OR my_cast.billing_order <= ${billingCutoff})
              AND (co_cast.billing_order IS NULL OR co_cast.billing_order <= ${billingCutoff})
          `);

          const nextFrontier: number[] = [];
          for (const r of rows) {
            if (parents.has(r.nextActor)) continue;
            parents.set(r.nextActor, {
              prev: r.prevActor,
              movie: r.viaMovie,
            });

            if (r.nextActor === actor2Id) {
              foundDepth = depth;
              return;
            }

            nextFrontier.push(r.nextActor);
          }

          frontier = nextFrontier;
        }
      });
    }

    if (foundDepth === null) {
      // The query succeeded; the graph just has no connection within
      // maxDepth. That's a valid result, not an error — return 200 with
      // an empty path so callers can render a "no connection found"
      // message instead of treating it as a failure.
      res.json({
        data: {
          degrees: null,
          fromActorId: actor1Id,
          toActorId: actor2Id,
          maxDepth,
          billingCutoff,
          path: [],
        },
      });
      return;
    }

    // Walk parent pointers back from target to start, then reverse.
    const actorIdsRev: number[] = [];
    const movieIdsRev: number[] = [];
    let cur: number | null = actor2Id;
    while (cur !== null) {
      actorIdsRev.push(cur);
      const p = parents.get(cur);
      if (!p) break;
      movieIdsRev.push(p.movie);
      cur = p.prev;
    }
    const actorIds = actorIdsRev.reverse();
    const movieIds = movieIdsRev.reverse();

    type DetailRow = {
      actors: Array<{
        tmdbId: number;
        name: string;
        profilePath: string | null;
      }>;
      movies: Array<{
        tmdbId: number;
        title: string;
        releaseYear: number | null;
        posterPath: string | null;
      }>;
    };

    // Build ARRAY[...]::int[] literals from validated integer IDs. sql.join
    // on an empty list collapses to nothing, yielding `ARRAY[]::int[]` for
    // the trivial actor1Id === actor2Id case.
    const actorIdsArr = sql`ARRAY[${sql.join(
      actorIds.map((id) => sql`${id}`),
      sql`, `,
    )}]::int[]`;
    const movieIdsArr = sql`ARRAY[${sql.join(
      movieIds.map((id) => sql`${id}`),
      sql`, `,
    )}]::int[]`;

    // One small SELECT to hydrate metadata for the resolved IDs. JSON
    // object keys are camelCase to match the rest of the API surface.
    const detailRows = await db.execute<DetailRow>(sql`
      SELECT
        (
          SELECT COALESCE(json_agg(
            json_build_object(
              'tmdbId', a.tmdb_id,
              'name', a.name,
              'profilePath', a.profile_path
            ) ORDER BY u.idx
          ), '[]'::json)
          FROM unnest(${actorIdsArr}) WITH ORDINALITY AS u(id, idx)
          JOIN ag_actors a ON a.tmdb_id = u.id
        ) AS actors,
        (
          SELECT COALESCE(json_agg(
            json_build_object(
              'tmdbId', f.tmdb_id,
              'title', f.title,
              'releaseYear', f.release_year,
              'posterPath', f.poster_path
            ) ORDER BY u.idx
          ), '[]'::json)
          FROM unnest(${movieIdsArr}) WITH ORDINALITY AS u(id, idx)
          JOIN ag_films f ON f.tmdb_id = u.id
        ) AS movies
    `);

    const detail = detailRows[0]!;

    type ActorStep = {
      kind: "actor";
      tmdbId: number;
      name: string;
      profilePath: string | null;
    };
    type FilmStep = {
      kind: "film";
      tmdbId: number;
      title: string;
      releaseYear: number | null;
      posterPath: string | null;
    };
    const steps: Array<ActorStep | FilmStep> = [];
    for (let i = 0; i < detail.actors.length; i++) {
      const actor = detail.actors[i]!;
      steps.push({ kind: "actor", ...actor });
      if (i < detail.movies.length) {
        steps.push({ kind: "film", ...detail.movies[i]! });
      }
    }

    res.json({
      data: {
        degrees: foundDepth as number,
        fromActorId: actor1Id,
        toActorId: actor2Id,
        maxDepth,
        billingCutoff,
        path: steps,
      },
    });
  } catch (error) {
    const isTimeout =
      error instanceof Error && /statement timeout/i.test(error.message);
    if (isTimeout) {
      res.status(504).json({
        error: "Path search timed out",
        message:
          "Try a smaller maxDepth or a stricter billingCutoff; these actors may not be well-connected.",
      });
      return;
    }

    const { status, body } = classifyError(error, "compute actor path");
    res.status(status).json(body);
  }
}

export async function searchGraph(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  const rawQuery = typeof req.query.q === "string" ? req.query.q.trim() : "";
  if (rawQuery.length < 2) {
    res.status(400).json({ error: "q must be at least 2 characters" });
    return;
  }
  if (rawQuery.length > MAX_SEARCH_QUERY_LENGTH) {
    res.status(400).json({
      error: `q must be at most ${MAX_SEARCH_QUERY_LENGTH} characters`,
    });
    return;
  }

  try {
    // Run DB + TMDB searches in parallel. Each leg degrades gracefully via
    // .catch(): a failure on one source returns empty results rather than
    // failing the whole endpoint, so e.g. a TMDB outage still yields DB
    // hits and vice versa.
    const [dbActors, dbMovies, tmdbPersons, tmdbMovies] = await Promise.all([
      dbSearchActors(rawQuery, 10).catch((err) => {
        console.warn(
          "DB actor search failed:",
          err instanceof Error ? err.message : err,
        );
        return [] as ActorSearchRow[];
      }),
      dbSearchMovies(rawQuery, 10).catch((err) => {
        console.warn(
          "DB movie search failed:",
          err instanceof Error ? err.message : err,
        );
        return [] as MovieSearchRow[];
      }),
      tmdbGet<TmdbPersonSearchResponse>("/search/person", {
        query: rawQuery,
        include_adult: false,
      }).catch((err) => {
        console.warn(
          "TMDB person search failed:",
          err instanceof Error ? err.message : err,
        );
        return { results: [] } as TmdbPersonSearchResponse;
      }),
      tmdbGet<TmdbMovieSearchResponse>("/search/movie", {
        query: rawQuery,
        include_adult: false,
      }).catch((err) => {
        console.warn(
          "TMDB movie search failed:",
          err instanceof Error ? err.message : err,
        );
        return { results: [] } as TmdbMovieSearchResponse;
      }),
    ]);

    const actors = mergeAndRank(
      dbActors.map((a) => ({
        ...a,
        type: "actor" as const,
        inDatabase: true,
      })),
      tmdbPersons.results.map((p) => ({
        tmdbId: p.id,
        name: p.name,
        profilePath: p.profile_path,
        popularity: p.popularity,
        type: "actor" as const,
        inDatabase: false,
      })),
      10,
    );

    const movies = mergeAndRank(
      dbMovies.map((m) => ({
        ...m,
        type: "movie" as const,
        inDatabase: true,
      })),
      tmdbMovies.results.map((m) => ({
        tmdbId: m.id,
        title: m.title,
        posterPath: m.poster_path,
        posterUrl: posterUrl(m.poster_path),
        releaseYear: extractReleaseYear(m.release_date),
        popularity: m.popularity,
        type: "movie" as const,
        inDatabase: false,
      })),
      10,
    );

    res.json({ data: { actors, movies } });
  } catch (error) {
    const { status, body } = classifyError(error, "search");
    res.status(status).json(body);
  }
}

export async function getActor(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  const tmdbId = parsePositiveInt(req.params.tmdbId);
  if (tmdbId === null) {
    res.status(400).json({ error: "tmdbId must be a positive integer" });
    return;
  }

  try {
    const actor = await ensureActor(tmdbId);
    if (!actor) {
      res.status(404).json({ error: "Actor not found" });
      return;
    }
    res.json({ data: actor });
  } catch (error) {
    const { status, body } = classifyError(error, "get actor");
    res.status(status).json(body);
  }
}

export async function getMovie(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  const tmdbId = parsePositiveInt(req.params.tmdbId);
  if (tmdbId === null) {
    res.status(400).json({ error: "tmdbId must be a positive integer" });
    return;
  }

  try {
    const movie = await ensureMovieWithCast(tmdbId);
    if (!movie) {
      res.status(404).json({ error: "Movie not found" });
      return;
    }
    res.json({ data: movie });
  } catch (error) {
    const { status, body } = classifyError(error, "get movie");
    res.status(status).json(body);
  }
}

export async function getCostars(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  const tmdbId = parsePositiveInt(req.params.tmdbId);
  if (tmdbId === null) {
    res.status(400).json({ error: "tmdbId must be a positive integer" });
    return;
  }

  let limit = DEFAULT_COSTARS_LIMIT;
  if (req.query.limit !== undefined) {
    const parsed = parseBoundedInt(req.query.limit, {
      min: 1,
      max: MAX_COSTARS_LIMIT,
    });
    if (parsed === null) {
      res.status(400).json({
        error: `limit must be an integer between 1 and ${MAX_COSTARS_LIMIT}`,
      });
      return;
    }
    limit = parsed;
  }

  try {
    const actor = await ensureActor(tmdbId);
    if (!actor) {
      res.status(404).json({ error: "Actor not found" });
      return;
    }

    const costars = await dbGetCostars(tmdbId, limit);

    res.json({
      data: {
        actorTmdbId: tmdbId,
        costars,
        count: costars.length,
        limit,
      },
    });
  } catch (error) {
    const { status, body } = classifyError(error, "get co-stars");
    res.status(status).json(body);
  }
}

export async function getCommonMovies(
  req: Request,
  res: Response<ApiResponse>,
): Promise<void> {
  const actor1Id = parsePositiveInt(req.params.actor1Id);
  const actor2Id = parsePositiveInt(req.params.actor2Id);
  if (actor1Id === null || actor2Id === null) {
    res.status(400).json({ error: "Both actor ids must be positive integers" });
    return;
  }

  try {
    // Ingest both actors in parallel before joining — either may be new.
    await Promise.all([ensureActor(actor1Id), ensureActor(actor2Id)]);

    const commonMovies = await dbGetCommonMovies(actor1Id, actor2Id);

    res.json({
      data: {
        actor1TmdbId: actor1Id,
        actor2TmdbId: actor2Id,
        commonMovies,
        count: commonMovies.length,
      },
    });
  } catch (error) {
    const { status, body } = classifyError(error, "get common movies");
    res.status(status).json(body);
  }
}
