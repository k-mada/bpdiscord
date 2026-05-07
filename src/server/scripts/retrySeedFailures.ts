import "dotenv/config";
import * as fs from "fs";
import { ensureMovieWithCast } from "../controllers/graphController";
import {
  FAILURES_PATH,
  FailureRecord,
  FilmFailureRecord,
  LiveRenderer,
  confirm,
  getDbHost,
  parsePosInt,
  runWithConcurrency,
  seedOneActor,
  withTmdbRetry,
  writeOrDeleteFailures,
} from "./seedActorGraph";

const DEFAULT_CONCURRENCY = 10;

// Cap on how many times we'll retry the same entry before giving up. Without
// this, an agent loop ("run seed:retry until file is gone") can spin forever
// on a genuinely unrecoverable failure (e.g., a deleted TMDB id returning
// 404). After this many cumulative attempts, the entry is dropped and logged
// to stdout so it's visible in the agent's run history.
const MAX_ATTEMPTS = 3;

type Args = {
  concurrency: number;
  dryRun: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    concurrency: DEFAULT_CONCURRENCY,
    dryRun: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--concurrency")
      args.concurrency = parsePosInt(argv[++i], "concurrency");
    else if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(`Usage: yarn seed:retry [--concurrency N] [--dry-run]`);
      process.exit(0);
    } else {
      console.error(`Unknown argument: ${arg}`);
      process.exit(1);
    }
  }
  return args;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

// Coerce a single record from raw JSON. attempts defaults to 1 when missing
// or invalid so files written by older seed runs (before the field existed)
// load cleanly — those entries had been attempted exactly once.
const normalizeAttempts = (raw: unknown): number =>
  typeof raw === "number" && raw > 0 ? raw : 1;

function loadFailures(): {
  actorFailures: FailureRecord[];
  filmFailures: FilmFailureRecord[];
} {
  if (!fs.existsSync(FAILURES_PATH)) {
    console.error(`No failures file found at ${FAILURES_PATH}`);
    console.error(
      `Run yarn seed:graph first; nothing to retry until that produces failures.`,
    );
    process.exit(1);
  }
  const raw = fs.readFileSync(FAILURES_PATH, "utf-8");
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    console.error(`Failures file at ${FAILURES_PATH} is not valid JSON.`);
    process.exit(1);
  }
  if (
    !isObject(parsed) ||
    !Array.isArray(parsed.actorFailures) ||
    !Array.isArray(parsed.filmFailures)
  ) {
    console.error(
      `Failures file at ${FAILURES_PATH} is malformed (missing actorFailures or filmFailures arrays).`,
    );
    process.exit(1);
  }
  const actorFailures: FailureRecord[] = parsed.actorFailures.map(
    (f: unknown) => {
      const r = f as Record<string, unknown>;
      return {
        tmdbId: r.tmdbId as number,
        name: r.name as string,
        error: r.error as string,
        attempts: normalizeAttempts(r.attempts),
      };
    },
  );
  const filmFailures: FilmFailureRecord[] = parsed.filmFailures.map(
    (f: unknown) => {
      const r = f as Record<string, unknown>;
      return {
        filmId: r.filmId as number,
        fromActorId: r.fromActorId as number,
        error: r.error as string,
        attempts: normalizeAttempts(r.attempts),
      };
    },
  );
  return { actorFailures, filmFailures };
}

// All mutable retry state lives at module scope so the SIGINT handler can
// flush it without each phase function having to thread it through. Single-
// threaded JS guarantees the handler sees a consistent snapshot at the moment
// it fires (workers are at await boundaries when SIGINT can interrupt them).
const state = {
  originalActorFailures: [] as FailureRecord[],
  originalFilmFailures: [] as FilmFailureRecord[],
  resolvedActorIds: new Set<number>(),
  resolvedFilmIds: new Set<number>(),
  // Re-failures accumulate here with attempts incremented.
  stillFailingActorsAcc: [] as FailureRecord[],
  stillFailingFilmsAcc: [] as FilmFailureRecord[],
  // Brand-new film failures emerging from successful actor retries (phase 1).
  // Always attempts=1 because the actor previously failed before reaching
  // the films loop, so the films were never tried before this run.
  newFilmFailuresAcc: [] as FilmFailureRecord[],
  // Permanents accumulated across the run: those loaded already past the cap
  // (skipped, never retried) plus those that hit the cap during finalize.
  // Logged together at the end for a single clear summary.
  permanentActorsSeen: [] as FailureRecord[],
  permanentFilmsSeen: [] as FilmFailureRecord[],
  activeRenderer: null as LiveRenderer | null,
};

// Compute the file's final retriable contents from current state. Newly-
// permanent entries (those that hit MAX_ATTEMPTS this run) are pushed into
// state.permanent*Seen so they appear in the final log alongside any that
// were already past the cap when loaded.
function finalize(): {
  retriableActors: FailureRecord[];
  retriableFilms: FilmFailureRecord[];
  newFilmFailuresQueued: number;
} {
  const stillActorMap = new Map(
    state.stillFailingActorsAcc.map((f) => [f.tmdbId, f]),
  );
  const finalActors: FailureRecord[] = [];
  for (const orig of state.originalActorFailures) {
    if (state.resolvedActorIds.has(orig.tmdbId)) continue;
    finalActors.push(stillActorMap.get(orig.tmdbId) ?? orig);
  }

  const stillFilmMap = new Map(
    state.stillFailingFilmsAcc.map((f) => [f.filmId, f]),
  );
  const finalFilms: FilmFailureRecord[] = [];
  for (const orig of state.originalFilmFailures) {
    if (state.resolvedFilmIds.has(orig.filmId)) continue;
    finalFilms.push(stillFilmMap.get(orig.filmId) ?? orig);
  }

  // New film failures from phase 1 actor retries. Dedupe against (a) films
  // we've already accounted for via originals/resolved — otherwise the same
  // filmId can appear twice with different attempt counts; and (b) films
  // already pushed in this loop — if two phase-1 actors share an un-hydrated
  // film, coalesce dedupes the TMDB call but both seedOneActor catch blocks
  // still fire, producing two newFilmFailuresAcc entries for the same id.
  const accountedFilmIds = new Set<number>([
    ...state.resolvedFilmIds,
    ...state.originalFilmFailures.map((f) => f.filmId),
  ]);
  let newFilmFailuresQueued = 0;
  for (const newFail of state.newFilmFailuresAcc) {
    if (accountedFilmIds.has(newFail.filmId)) continue;
    accountedFilmIds.add(newFail.filmId);
    finalFilms.push(newFail);
    newFilmFailuresQueued++;
  }

  const retriableActors: FailureRecord[] = [];
  for (const f of finalActors) {
    if (f.attempts >= MAX_ATTEMPTS) state.permanentActorsSeen.push(f);
    else retriableActors.push(f);
  }
  const retriableFilms: FilmFailureRecord[] = [];
  for (const f of finalFilms) {
    if (f.attempts >= MAX_ATTEMPTS) state.permanentFilmsSeen.push(f);
    else retriableFilms.push(f);
  }

  return { retriableActors, retriableFilms, newFilmFailuresQueued };
}

function logAllPermanent(): void {
  const total =
    state.permanentActorsSeen.length + state.permanentFilmsSeen.length;
  if (total === 0) return;
  console.log(
    `\nDropped ${total} permanent failure(s) (>=${MAX_ATTEMPTS} attempts):`,
  );
  for (const f of state.permanentActorsSeen) {
    console.log(`  Actor ${f.tmdbId} (${f.name}): ${f.error}`);
  }
  for (const f of state.permanentFilmsSeen) {
    console.log(`  Film ${f.filmId} (from actor ${f.fromActorId}): ${f.error}`);
  }
}

async function retryActorFailures(concurrency: number): Promise<void> {
  if (state.originalActorFailures.length === 0) return;

  console.log(
    `\nPhase 1: retrying ${state.originalActorFailures.length} actor failure(s)...`,
  );
  const renderer = new LiveRenderer({
    successLabel: "Actors recovered",
    remainingLabel: "Actors remaining",
    failureLabel: "Still failing",
  });
  state.activeRenderer = renderer;
  renderer.start(state.originalActorFailures.length);

  await runWithConcurrency(
    state.originalActorFailures.map((f) => ({
      tmdbId: f.tmdbId,
      name: f.name,
      priorAttempts: f.attempts,
    })),
    concurrency,
    async (actor) => {
      // Per-worker local buffer so we can determine recovery without racing
      // on the shared array's length. seedOneActor pushes at most one entry
      // (the actor-level catch); concurrent workers writing to a shared
      // array would corrupt a length-based "did this one push?" check.
      const localActorFailures: FailureRecord[] = [];
      await seedOneActor(
        actor,
        renderer,
        localActorFailures,
        state.newFilmFailuresAcc,
      );
      if (localActorFailures.length === 0) {
        state.resolvedActorIds.add(actor.tmdbId);
      } else {
        state.stillFailingActorsAcc.push(...localActorFailures);
      }
    },
  );

  renderer.stop();
  state.activeRenderer = null;
}

async function retryFilmFailures(concurrency: number): Promise<void> {
  // Phase 1 may have hydrated some of these films as a side effect of
  // recovering an actor whose filmography includes them. Filter those out so
  // phase 2 doesn't waste a roundtrip per cached entry — and so the renderer
  // shows a count that reflects actual work, not pre-resolved no-ops.
  const toRetry = state.originalFilmFailures.filter(
    (f) => !state.resolvedFilmIds.has(f.filmId),
  );
  if (toRetry.length === 0) return;

  console.log(`\nPhase 2: retrying ${toRetry.length} film failure(s)...`);
  const renderer = new LiveRenderer({
    successLabel: "Films recovered",
    remainingLabel: "Films remaining",
    failureLabel: "Still failing",
  });
  state.activeRenderer = renderer;
  renderer.start(toRetry.length);

  await runWithConcurrency(toRetry, concurrency, async (film) => {
    renderer.setCurrentLabel(`Hydrating film ${film.filmId}`);
    try {
      await withTmdbRetry(() => ensureMovieWithCast(film.filmId));
      state.resolvedFilmIds.add(film.filmId);
      renderer.recordSuccess();
    } catch (err) {
      state.stillFailingFilmsAcc.push({
        filmId: film.filmId,
        fromActorId: film.fromActorId,
        error: err instanceof Error ? err.message : String(err),
        attempts: film.attempts + 1,
      });
      renderer.recordFailure();
    }
  });

  renderer.stop();
  state.activeRenderer = null;
}

async function main(): Promise<void> {
  if (!process.env.TMDB_READ_API_TOKEN) {
    console.error("TMDB_READ_API_TOKEN is required");
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));

  console.log(`Target DB: ${getDbHost()}`);

  const loaded = loadFailures();

  // Pre-partition: anything already at or past the cap gets dropped before
  // we waste a TMDB call on it. Most common cause is a previous run that
  // pushed an entry to attempts=MAX_ATTEMPTS and persisted it (e.g., before
  // a process crash interrupted the file rewrite). They land in
  // state.permanent*Seen and are surfaced via logAllPermanent below.
  for (const f of loaded.actorFailures) {
    if (f.attempts >= MAX_ATTEMPTS) state.permanentActorsSeen.push(f);
    else state.originalActorFailures.push(f);
  }
  for (const f of loaded.filmFailures) {
    if (f.attempts >= MAX_ATTEMPTS) state.permanentFilmsSeen.push(f);
    else state.originalFilmFailures.push(f);
  }

  const droppedActors = state.permanentActorsSeen.length;
  const droppedFilms = state.permanentFilmsSeen.length;

  console.log(`Loaded failures from ${FAILURES_PATH}:`);
  console.log(
    `  Actor failures: ${state.originalActorFailures.length}` +
      (droppedActors > 0 ? ` (+${droppedActors} already past cap)` : ""),
  );
  console.log(
    `  Film failures:  ${state.originalFilmFailures.length}` +
      (droppedFilms > 0 ? ` (+${droppedFilms} already past cap)` : ""),
  );

  if (
    state.originalActorFailures.length === 0 &&
    state.originalFilmFailures.length === 0
  ) {
    console.log(`\nNothing to retry.`);
    logAllPermanent();
    // Drop the file regardless: anything left was already past the cap and
    // we've logged it. Agent loop terminates because the file is gone.
    if (fs.existsSync(FAILURES_PATH)) fs.unlinkSync(FAILURES_PATH);
    process.exit(0);
  }

  if (args.dryRun) {
    console.log(`\nDry run; exiting without writes.`);
    process.exit(0);
  }

  const proceed = await confirm("\nProceed with retry? [y/N] ");
  if (!proceed) {
    console.log("Aborted.");
    process.exit(0);
  }

  const shutdown = (): void => {
    if (state.activeRenderer) state.activeRenderer.stop();
    const { retriableActors, retriableFilms } = finalize();
    logAllPermanent();
    writeOrDeleteFailures(retriableActors, retriableFilms);
    process.exit(130);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await retryActorFailures(args.concurrency);
  await retryFilmFailures(args.concurrency);

  const { retriableActors, retriableFilms, newFilmFailuresQueued } = finalize();

  const recoveredActors =
    state.originalActorFailures.length - state.stillFailingActorsAcc.length;
  const recoveredFilms =
    state.originalFilmFailures.length - state.stillFailingFilmsAcc.length;

  console.log(`\nDone.`);
  console.log(`  Actors recovered:        ${recoveredActors}`);
  console.log(`  Actors still failing:    ${state.stillFailingActorsAcc.length}`);
  console.log(`  Films recovered:         ${recoveredFilms}`);
  console.log(`  Films still failing:     ${state.stillFailingFilmsAcc.length}`);
  if (newFilmFailuresQueued > 0) {
    console.log(
      `  New film failures (queued for next retry): ${newFilmFailuresQueued}`,
    );
  }

  logAllPermanent();
  writeOrDeleteFailures(retriableActors, retriableFilms);

  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    // Print only message + stack. Do NOT print the error object directly:
    // `console.error("Fatal:", axiosError)` expands `err.config.headers` via
    // util.inspect, which leaks the TMDB Bearer token to stdout.
    if (err instanceof Error) {
      console.error("Fatal:", err.message);
      if (err.stack) console.error(err.stack);
    } else {
      console.error("Fatal:", String(err));
    }
    process.exit(1);
  });
}
