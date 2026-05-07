import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import axios, { AxiosError } from "axios";
import { and, eq, inArray, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import { agActedIn, agActors, agFilms } from "../db/schema";
import {
  ensureActor,
  ensureMovieWithCast,
} from "../controllers/graphController";

const TMDB_BASE = "https://api.themoviedb.org/3";
const BILLING_CUTOFF = 15;
const SPINNER_FRAMES = ["|", "/", "-", "\\"];
// Resolved relative to this file's source location so the failures file lands
// at repo root regardless of the cwd `yarn seed:graph` runs from.
export const FAILURES_PATH = path.resolve(__dirname, "..", "..", "..", "seed-failures.json");

const DEFAULT_LIMIT = 5000;
const DEFAULT_CONCURRENCY = 10;
const DEFAULT_START_PAGE = 1;
const TMDB_RETRY_ATTEMPTS = 4;

type Args = {
  limit: number;
  concurrency: number;
  startPage: number;
  dryRun: boolean;
};

export function parsePosInt(raw: string | undefined, name: string): number {
  const n = Number.parseInt(raw ?? "", 10);
  if (!Number.isInteger(n) || n <= 0) {
    console.error(`--${name} must be a positive integer (got: ${raw})`);
    process.exit(1);
  }
  return n;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    limit: DEFAULT_LIMIT,
    concurrency: DEFAULT_CONCURRENCY,
    startPage: DEFAULT_START_PAGE,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--limit") args.limit = parsePosInt(argv[++i], "limit");
    else if (arg === "--concurrency")
      args.concurrency = parsePosInt(argv[++i], "concurrency");
    else if (arg === "--start-page")
      args.startPage = parsePosInt(argv[++i], "start-page");
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        `Usage: yarn seed:graph [--limit N] [--concurrency N] [--start-page N] [--dry-run]`,
      );
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

type PopularResult = {
  results: Array<{
    id: number;
    name: string;
    known_for_department?: string;
  }>;
  total_pages: number;
};

// Wraps any TMDB-touching async call (raw axios.get, ensureActor,
// ensureMovieWithCast) with retry-on-throttle semantics. Retries on AxiosError
// with status 429 or 5xx; honors `Retry-After` when present, otherwise capped
// exponential backoff. Non-retryable errors (4xx other than 429, non-Axios
// errors) propagate immediately.
export async function withTmdbRetry<T>(
  fn: () => Promise<T>,
  attempts = TMDB_RETRY_ATTEMPTS,
): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (err instanceof AxiosError) {
        const status = err.response?.status;
        const retryable =
          status === 429 || (status !== undefined && status >= 500);
        if (retryable && attempt < attempts - 1) {
          const retryAfterRaw = err.response?.headers?.["retry-after"];
          const retryAfter = Number(retryAfterRaw);
          const waitSec =
            Number.isFinite(retryAfter) && retryAfter > 0
              ? Math.min(30, retryAfter)
              : Math.min(30, 2 ** attempt);
          await new Promise((r) => setTimeout(r, waitSec * 1000));
          continue;
        }
      }
      throw err;
    }
  }
  throw lastErr;
}

async function fetchPopularActorIds(
  limit: number,
  startPage: number,
): Promise<Array<{ tmdbId: number; name: string }>> {
  const token = process.env.TMDB_READ_API_TOKEN;
  if (!token) throw new Error("TMDB_READ_API_TOKEN is required");

  const collected = new Map<number, string>();
  let page = startPage;
  while (collected.size < limit) {
    const data = await withTmdbRetry(async () => {
      const resp = await axios.get<PopularResult>(
        `${TMDB_BASE}/person/popular`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { page },
          timeout: 10_000,
        },
      );
      return resp.data;
    });
    if (!data.results || data.results.length === 0) break;
    for (const r of data.results) {
      if (collected.size >= limit) break;
      // /person/popular includes directors, writers, etc. Skip non-actors —
      // their movie_credits.cast is empty so seeding them produces zero edges
      // and just burns one TMDB call.
      if (r.known_for_department !== "Acting") continue;
      if (Number.isInteger(r.id) && typeof r.name === "string" && r.name) {
        collected.set(r.id, r.name);
      }
    }
    if (page >= data.total_pages) break;
    page++;
  }
  return [...collected.entries()].map(([tmdbId, name]) => ({ tmdbId, name }));
}

export type LiveRendererOptions = {
  successLabel?: string;
  remainingLabel?: string;
  failureLabel?: string;
  doneLabel?: string;
};

export class LiveRenderer {
  private linesDrawn = 0;
  private spinIdx = 0;
  private currentLabel: string | null = null;
  private successCount = 0;
  private failureCount = 0;
  private remaining = 0;
  private interval: NodeJS.Timeout | null = null;
  private done = false;

  constructor(private readonly options: LiveRendererOptions = {}) {}

  start(initialRemaining: number): void {
    this.remaining = initialRemaining;
    this.draw();
    this.interval = setInterval(() => this.draw(), 100);
  }

  setCurrentLabel(label: string): void {
    this.currentLabel = label;
  }

  recordSuccess(): void {
    this.successCount++;
    this.remaining--;
  }

  recordFailure(): void {
    this.failureCount++;
    this.remaining--;
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.done = true;
    this.draw();
    process.stdout.write("\n");
  }

  private draw(): void {
    const spin = this.done
      ? "[done]"
      : SPINNER_FRAMES[this.spinIdx++ % SPINNER_FRAMES.length];
    const label = this.done
      ? this.options.doneLabel ?? "Done"
      : this.currentLabel ?? "...";

    const successLabel =
      this.options.successLabel ?? "Actors successfully seeded";
    const remainingLabel = this.options.remainingLabel ?? "Actors remaining";
    const failureLabel = this.options.failureLabel ?? "Failed seedings";

    const lines = [
      "-------------------------------------------------",
      `-- ${label} ${spin}`,
      "-------------------------------------------------",
      "",
      `${successLabel}: ${this.successCount}`,
      `${remainingLabel}: ${this.remaining}`,
      `${failureLabel}: ${this.failureCount}`,
    ];

    if (this.linesDrawn > 0) {
      process.stdout.write(`\x1b[${this.linesDrawn}A\x1b[J`);
    }
    process.stdout.write(lines.join("\n") + "\n");
    this.linesDrawn = lines.length;
  }
}

export async function runWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  let cursor = 0;
  const workerCount = Math.min(concurrency, items.length);
  const tasks = Array.from({ length: workerCount }, async () => {
    while (true) {
      const idx = cursor++;
      if (idx >= items.length) return;
      const item = items[idx];
      if (item === undefined) return;
      await worker(item);
    }
  });
  await Promise.all(tasks);
}

// `attempts` tracks how many times this entry has failed across all runs.
// The retry script drops entries that exceed a cap, which prevents an agent
// loop ("run seed:retry until file is gone") from spinning forever on a
// genuinely unrecoverable failure (e.g., TMDB returning 404 for a deleted id).
export type FailureRecord = {
  tmdbId: number;
  name: string;
  error: string;
  attempts: number;
};

export type FilmFailureRecord = {
  filmId: number;
  fromActorId: number;
  error: string;
  attempts: number;
};

export async function seedOneActor(
  actor: { tmdbId: number; name: string; priorAttempts: number },
  renderer: LiveRenderer,
  actorFailures: FailureRecord[],
  filmFailures: FilmFailureRecord[],
): Promise<void> {
  renderer.setCurrentLabel(`Fetching ${actor.name} (${actor.tmdbId})`);
  try {
    const actorRow = await withTmdbRetry(() => ensureActor(actor.tmdbId));
    if (!actorRow) {
      throw new Error("ensureActor returned null");
    }

    const films = await db
      .select({
        tmdbId: agFilms.tmdbId,
        castFullyFetched: agFilms.castFullyFetched,
      })
      .from(agActedIn)
      .innerJoin(agFilms, eq(agFilms.tmdbId, agActedIn.movieTmdbId))
      .where(
        and(
          eq(agActedIn.actorTmdbId, actor.tmdbId),
          or(
            isNull(agActedIn.billingOrder),
            lte(agActedIn.billingOrder, BILLING_CUTOFF),
          ),
        ),
      );

    for (const film of films) {
      if (film.castFullyFetched) continue;
      try {
        await withTmdbRetry(() => ensureMovieWithCast(film.tmdbId));
      } catch (err) {
        // Per-film failures are non-fatal; the actor is still recorded as a
        // success but the failure is tracked so we can surface it in the
        // summary and seed-failures.json. attempts=1 because this is the
        // first time this film failed (the actor previously failed before
        // ever reaching the films loop).
        filmFailures.push({
          filmId: film.tmdbId,
          fromActorId: actor.tmdbId,
          error: err instanceof Error ? err.message : String(err),
          attempts: 1,
        });
      }
    }

    renderer.recordSuccess();
  } catch (err) {
    actorFailures.push({
      tmdbId: actor.tmdbId,
      name: actor.name,
      error: err instanceof Error ? err.message : String(err),
      attempts: actor.priorAttempts + 1,
    });
    renderer.recordFailure();
  }
}

async function preflight(
  actors: Array<{ tmdbId: number; name: string }>,
): Promise<void> {
  const ids = actors.map((a) => a.tmdbId);
  const fetched = await db
    .select({ count: sql<number>`COUNT(*)::int` })
    .from(agActors)
    .where(and(inArray(agActors.tmdbId, ids), eq(agActors.fullyFetched, true)));

  const alreadyFetched = fetched[0]?.count ?? 0;
  const toProcess = actors.length - alreadyFetched;
  // Rough envelope: 1 person call + ~5-10 unique film calls per remaining
  // actor after dedup. Films are heavily shared across popular actors.
  const estLow = Math.max(0, toProcess * 5);
  const estHigh = Math.max(0, toProcess * 10);
  const minLow = Math.max(1, Math.round(estLow / 600));
  const minHigh = Math.max(2, Math.round(estHigh / 300));

  console.log(`\nSeeding plan:`);
  console.log(`  Top actors to seed:    ${actors.length}`);
  console.log(`  Already fully fetched: ${alreadyFetched}`);
  console.log(`  Actors to process:     ${toProcess}`);
  console.log(
    `  Est. TMDB calls:       ~${estLow.toLocaleString()}-${estHigh.toLocaleString()}`,
  );
  console.log(`  Est. runtime:          ~${minLow}-${minHigh} min`);
}

export async function confirm(message: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error(
      "\nNon-interactive shell — confirmation prompt requires a TTY. Aborting.",
    );
    return false;
  }
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await new Promise<string>((resolve) =>
    rl.question(message, resolve),
  );
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

// Single source of truth for persisting failure state. Deletes the file when
// both lists are empty so an "agent loop until gone" pattern terminates.
// Logs its own action (write or delete) so callers don't need to.
export function writeOrDeleteFailures(
  actorFailures: FailureRecord[],
  filmFailures: FilmFailureRecord[],
): void {
  if (actorFailures.length === 0 && filmFailures.length === 0) {
    if (fs.existsSync(FAILURES_PATH)) {
      fs.unlinkSync(FAILURES_PATH);
      console.log(`No failures — removed ${FAILURES_PATH}`);
    }
    return;
  }
  const payload = {
    completedAt: new Date().toISOString(),
    actorFailureCount: actorFailures.length,
    filmFailureCount: filmFailures.length,
    actorFailures,
    filmFailures,
  };
  fs.writeFileSync(FAILURES_PATH, JSON.stringify(payload, null, 2));
  console.log(`Failures written to ${FAILURES_PATH}`);
}

async function main(): Promise<void> {
  if (!process.env.TMDB_READ_API_TOKEN) {
    console.error("TMDB_READ_API_TOKEN is required");
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));

  console.log(`Limit:       ${args.limit}`);
  console.log(`Concurrency: ${args.concurrency}`);
  console.log(`Start page:  ${args.startPage}`);

  console.log(`\nFetching popular actor IDs from TMDB...`);
  const actors = await fetchPopularActorIds(args.limit, args.startPage);
  console.log(`Got ${actors.length} actors.`);

  await preflight(actors);

  if (args.dryRun) {
    console.log(`\nDry run; exiting without writes.`);
    process.exit(0);
  }

  const proceed = await confirm("\nProceed? [y/N] ");
  if (!proceed) {
    console.log("Aborted.");
    process.exit(0);
  }

  const actorFailures: FailureRecord[] = [];
  const filmFailures: FilmFailureRecord[] = [];
  const renderer = new LiveRenderer();

  let interrupted = false;
  const shutdown = (): void => {
    if (interrupted) return;
    interrupted = true;
    renderer.stop();
    // On early interrupt (no failures yet), don't touch an existing file
    // from a previous run — the user may want it preserved. Only flush if
    // we've actually accumulated something.
    if (actorFailures.length > 0 || filmFailures.length > 0) {
      writeOrDeleteFailures(actorFailures, filmFailures);
    }
    process.exit(130);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  console.log("");
  renderer.start(actors.length);

  await runWithConcurrency(actors, args.concurrency, async (actor) => {
    if (interrupted) return;
    await seedOneActor(
      { ...actor, priorAttempts: 0 },
      renderer,
      actorFailures,
      filmFailures,
    );
  });

  if (interrupted) return;
  renderer.stop();

  const successfulActors = actors.length - actorFailures.length;
  const partialSuccessActors = new Set(filmFailures.map((f) => f.fromActorId))
    .size;

  console.log(`\nDone.`);
  console.log(`  Successful actors:       ${successfulActors}`);
  console.log(`  Failed actors:           ${actorFailures.length}`);
  console.log(
    `  Partial successes:       ${partialSuccessActors} (actors with >=1 film hydration failure)`,
  );
  console.log(`  Film hydration failures: ${filmFailures.length}`);

  writeOrDeleteFailures(actorFailures, filmFailures);

  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
