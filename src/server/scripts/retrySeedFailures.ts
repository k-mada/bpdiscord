import "dotenv/config";
import * as fs from "fs";
import { ensureMovieWithCast } from "../controllers/graphController";
import {
  FAILURES_PATH,
  FailureRecord,
  FilmFailureRecord,
  LiveRenderer,
  confirm,
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
  activeRenderer: null as LiveRenderer | null,
};

// Compute the file's final contents from current state. Used by both normal
// completion and the SIGINT handler — same logic either way: anything in the
// originals not yet resolved survives, with updated attempts when re-tried.
function finalize(): {
  retriableActors: FailureRecord[];
  retriableFilms: FilmFailureRecord[];
  permanentActors: FailureRecord[];
  permanentFilms: FilmFailureRecord[];
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
  // New film failures from phase 1 actor retries — never reached MAX_ATTEMPTS
  // because attempts=1, so they go straight into the retriable bucket below.
  finalFilms.push(...state.newFilmFailuresAcc);

  const retriableActors = finalActors.filter((f) => f.attempts < MAX_ATTEMPTS);
  const permanentActors = finalActors.filter((f) => f.attempts >= MAX_ATTEMPTS);
  const retriableFilms = finalFilms.filter((f) => f.attempts < MAX_ATTEMPTS);
  const permanentFilms = finalFilms.filter((f) => f.attempts >= MAX_ATTEMPTS);

  return { retriableActors, retriableFilms, permanentActors, permanentFilms };
}

function logPermanent(
  permanentActors: FailureRecord[],
  permanentFilms: FilmFailureRecord[],
): void {
  if (permanentActors.length === 0 && permanentFilms.length === 0) return;
  console.log(
    `\nDropped ${permanentActors.length + permanentFilms.length} permanent failure(s) (>=${MAX_ATTEMPTS} attempts):`,
  );
  for (const f of permanentActors) {
    console.log(`  Actor ${f.tmdbId} (${f.name}): ${f.error}`);
  }
  for (const f of permanentFilms) {
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
      const before = state.stillFailingActorsAcc.length;
      await seedOneActor(
        actor,
        renderer,
        state.stillFailingActorsAcc,
        state.newFilmFailuresAcc,
      );
      // seedOneActor pushes to stillFailingActorsAcc on actor-level failure.
      // If nothing was pushed, the actor recovered.
      if (state.stillFailingActorsAcc.length === before) {
        state.resolvedActorIds.add(actor.tmdbId);
      }
    },
  );

  renderer.stop();
  state.activeRenderer = null;
}

async function retryFilmFailures(concurrency: number): Promise<void> {
  if (state.originalFilmFailures.length === 0) return;

  console.log(
    `\nPhase 2: retrying ${state.originalFilmFailures.length} film failure(s)...`,
  );
  const renderer = new LiveRenderer({
    successLabel: "Films recovered",
    remainingLabel: "Films remaining",
    failureLabel: "Still failing",
  });
  state.activeRenderer = renderer;
  renderer.start(state.originalFilmFailures.length);

  await runWithConcurrency(
    state.originalFilmFailures,
    concurrency,
    async (film) => {
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
    },
  );

  renderer.stop();
  state.activeRenderer = null;
}

async function main(): Promise<void> {
  if (!process.env.TMDB_READ_API_TOKEN) {
    console.error("TMDB_READ_API_TOKEN is required");
    process.exit(1);
  }

  const args = parseArgs(process.argv.slice(2));
  const loaded = loadFailures();
  state.originalActorFailures = loaded.actorFailures;
  state.originalFilmFailures = loaded.filmFailures;

  console.log(`Loaded failures from ${FAILURES_PATH}:`);
  console.log(`  Actor failures: ${state.originalActorFailures.length}`);
  console.log(`  Film failures:  ${state.originalFilmFailures.length}`);

  if (
    state.originalActorFailures.length === 0 &&
    state.originalFilmFailures.length === 0
  ) {
    console.log(`\nNothing to retry.`);
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

  let interrupted = false;
  const shutdown = (): void => {
    if (interrupted) return;
    interrupted = true;
    if (state.activeRenderer) state.activeRenderer.stop();
    const { retriableActors, retriableFilms, permanentActors, permanentFilms } =
      finalize();
    logPermanent(permanentActors, permanentFilms);
    writeOrDeleteFailures(retriableActors, retriableFilms);
    process.exit(130);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await retryActorFailures(args.concurrency);
  if (interrupted) return;

  await retryFilmFailures(args.concurrency);
  if (interrupted) return;

  const { retriableActors, retriableFilms, permanentActors, permanentFilms } =
    finalize();

  const recoveredActors =
    state.originalActorFailures.length - state.stillFailingActorsAcc.length;
  const recoveredFilms =
    state.originalFilmFailures.length - state.stillFailingFilmsAcc.length;

  console.log(`\nDone.`);
  console.log(`  Actors recovered:        ${recoveredActors}`);
  console.log(`  Actors still failing:    ${state.stillFailingActorsAcc.length}`);
  console.log(`  Films recovered:         ${recoveredFilms}`);
  console.log(`  Films still failing:     ${state.stillFailingFilmsAcc.length}`);
  if (state.newFilmFailuresAcc.length > 0) {
    console.log(
      `  New film failures (queued for next retry): ${state.newFilmFailuresAcc.length}`,
    );
  }

  logPermanent(permanentActors, permanentFilms);
  writeOrDeleteFailures(retriableActors, retriableFilms);

  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
  });
}
