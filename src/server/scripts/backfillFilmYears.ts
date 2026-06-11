import "dotenv/config";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import axios from "axios";
import { sql, TransactionRollbackError } from "drizzle-orm";
import { db, dbClient } from "../db";

// Resolved relative to this file's source location so the failures file lands
// at repo root regardless of the cwd `yarn backfill:film-years` runs from.
export const FAILURES_PATH = path.resolve(
  __dirname,
  "..",
  "..",
  "..",
  "backfill-film-years-failures.json",
);

interface Args {
  dryRun: boolean;
  shortcutOnly: boolean;
  workerOnly: boolean;
  batchSize: number;
}

interface FailureRecord {
  film_slug: string;
  error: string;
  batch: number;
  at: string;
}

function parseArgs(argv: string[]): Args {
  const args: Args = {
    dryRun: false,
    shortcutOnly: false,
    workerOnly: false,
    batchSize: 100,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--dry-run") args.dryRun = true;
    else if (arg === "--shortcut-only") args.shortcutOnly = true;
    else if (arg === "--worker-only") args.workerOnly = true;
    else if (arg === "--batch-size") {
      const raw = argv[++i] ?? "";
      const n = parseInt(raw, 10);
      if (!Number.isFinite(n) || n <= 0) {
        console.error("--batch-size requires a positive integer");
        process.exit(1);
      }
      args.batchSize = n;
    } else if (arg === "--help" || arg === "-h") {
      console.log(
        `Usage: yarn backfill:film-years [--dry-run] [--shortcut-only|--worker-only] [--batch-size N]`,
      );
      process.exit(0);
    } else {
      console.error(`Unknown arg: ${arg}`);
      process.exit(1);
    }
  }
  if (args.shortcutOnly && args.workerOnly) {
    console.error("--shortcut-only and --worker-only are mutually exclusive");
    process.exit(1);
  }
  return args;
}

function getDbHost(): string {
  const url = process.env.DATABASE_URL;
  if (!url) return "(DATABASE_URL not set)";
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}${parsed.port ? `:${parsed.port}` : ""}`;
  } catch {
    return "(invalid DATABASE_URL)";
  }
}

async function confirm(message: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error(
      "Non-interactive shell — confirmation prompt requires a TTY. Aborting.",
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

// Single source of truth for persisting the failure list across the run +
// SIGINT shutdown. Deletes the file when the list is empty so an
// "operator retries until clean" pattern terminates without leftover noise.
function writeOrDeleteFailures(failures: FailureRecord[]): void {
  if (failures.length === 0) {
    if (fs.existsSync(FAILURES_PATH)) {
      fs.unlinkSync(FAILURES_PATH);
      console.log(`No failures — removed ${FAILURES_PATH}`);
    }
    return;
  }
  const payload = {
    completedAt: new Date().toISOString(),
    failureCount: failures.length,
    failures,
  };
  fs.writeFileSync(FAILURES_PATH, JSON.stringify(payload, null, 2));
  console.log(`Failures written to ${FAILURES_PATH}`);
}

// Phase 1: copy release_year from ag_films where Films.tmdb_link maps to a
// known ag_films row that already has a year. Idempotent via the
// `release_year IS NULL` guard. Deliberately does NOT bump updated_at —
// backfill is bookkeeping, not a content change.
async function runShortcut(dryRun: boolean): Promise<number> {
  // `\\d` in the template literal -> `\d` in the SQL sent to Postgres.
  const stmt = sql`
    UPDATE "Films" f
    SET release_year = a.release_year
    FROM ag_films a
    WHERE f.release_year IS NULL
      AND a.release_year IS NOT NULL
      AND (regexp_match(f.tmdb_link, '/movie/(\\d+)'))[1]::int = a.tmdb_id
    RETURNING f.film_slug
  `;

  if (!dryRun) {
    const rows = await db.execute(stmt);
    return rows.length;
  }

  // tx.rollback() throws TransactionRollbackError, which propagates out of
  // the transaction wrapper — must be caught here, not swallowed silently.
  let count = 0;
  try {
    await db.transaction(async (tx) => {
      const rows = await tx.execute(stmt);
      count = rows.length;
      tx.rollback();
    });
  } catch (e) {
    if (!(e instanceof TransactionRollbackError)) throw e;
  }
  return count;
}

interface WorkerBatchResp {
  processed: number;
  updated: number;
  failures: Array<{ film_slug: string; error: string }>;
}

interface WorkerCallArgs {
  workerUrl: string;
  secret: string;
  batchSize: number;
  dryRun: boolean;
}

async function callWorker(args: WorkerCallArgs): Promise<WorkerBatchResp> {
  const url = `${args.workerUrl.replace(/\/+$/, "")}/backfill-film-years`;
  // 5s per slug accommodates ~1-2s Letterboxd fetch + worker overhead with
  // enough headroom that a slow page doesn't trip the timeout.
  const timeoutMs = Math.max(args.batchSize * 5_000, 60_000);
  const resp = await axios.post<WorkerBatchResp>(
    url,
    { batch_size: args.batchSize, dry_run: args.dryRun },
    {
      headers: { Authorization: `Bearer ${args.secret}` },
      timeout: timeoutMs,
    },
  );
  return resp.data;
}

// Wraps callWorker with retry for transient errors. Skips retry on 4xx
// (auth, validation — won't fix themselves) and on the final attempt.
// Backoff: 1s, 4s, 16s.
async function callWorkerWithRetry(
  args: WorkerCallArgs,
  maxAttempts = 3,
): Promise<WorkerBatchResp> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await callWorker(args);
    } catch (e) {
      const status = axios.isAxiosError(e) ? e.response?.status : undefined;
      const isClientError = status !== undefined && status >= 400 && status < 500;
      const msg = e instanceof Error ? e.message : String(e);
      const statusSuffix = status !== undefined ? ` (status ${status})` : "";

      if (isClientError || attempt === maxAttempts) {
        console.error(
          `[worker] attempt ${attempt}/${maxAttempts} failed: ${msg}${statusSuffix}${isClientError ? " — not retrying (4xx)" : ""}`,
        );
        throw e;
      }

      const backoffMs = Math.pow(4, attempt - 1) * 1_000;
      console.error(
        `[worker] attempt ${attempt}/${maxAttempts} failed: ${msg}${statusSuffix} — retrying in ${backoffMs}ms`,
      );
      await new Promise((r) => setTimeout(r, backoffMs));
    }
  }
  // Unreachable — the loop either returns or throws — but TS needs it.
  throw new Error("callWorkerWithRetry exhausted");
}

async function runWorkerLoop(
  args: WorkerCallArgs,
  failures: FailureRecord[],
): Promise<{ processed: number; updated: number }> {
  let processed = 0;
  let updated = 0;
  let iter = 0;

  while (true) {
    iter++;
    const resp = await callWorkerWithRetry(args);

    processed += resp.processed;
    updated += resp.updated;

    console.log(
      `[worker] batch ${iter}: processed=${resp.processed} updated=${resp.updated} failures=${resp.failures.length} (cumulative processed=${processed} updated=${updated})`,
    );

    const at = new Date().toISOString();
    for (const f of resp.failures) {
      console.error(`  ! ${f.film_slug}: ${f.error}`);
      failures.push({ film_slug: f.film_slug, error: f.error, batch: iter, at });
    }

    // Dry-run never drains the NULL pool, so a `processed === 0` stop
    // condition would never fire. Stop after one batch.
    if (args.dryRun) {
      console.log(`[worker] dry-run: stopping after first batch`);
      break;
    }

    if (resp.processed === 0) break;
  }

  return { processed, updated };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SHARED_SECRET;
  if (!args.shortcutOnly) {
    if (!workerUrl || !workerSecret) {
      console.error(
        "WORKER_URL and WORKER_SHARED_SECRET are required for the worker phase",
      );
      process.exit(1);
    }
    // Catch a misconfigured WORKER_URL (e.g. missing scheme) up front
    // rather than dying inside axios with a confusing error.
    try {
      new URL(workerUrl);
    } catch {
      console.error(
        `WORKER_URL is not a valid URL: ${workerUrl} (missing scheme?)`,
      );
      process.exit(1);
    }
  }

  console.log(`Target DB:  ${getDbHost()}`);
  console.log(`Worker:     ${workerUrl ?? "(skipped)"}`);
  console.log(`Batch size: ${args.batchSize}`);
  console.log(`Dry run:    ${args.dryRun ? "YES (no writes)" : "no"}`);
  console.log(
    `Phases:     ${
      args.shortcutOnly
        ? "shortcut only"
        : args.workerOnly
          ? "worker only"
          : "shortcut + worker"
    }`,
  );

  if (!args.dryRun) {
    const proceed = await confirm("\nProceed with writes? [y/N] ");
    if (!proceed) {
      console.log("Aborted.");
      await dbClient.end();
      process.exit(0);
    }
  }

  const failures: FailureRecord[] = [];

  // SIGINT/SIGTERM flush so a Ctrl+C mid-run preserves whatever failures
  // we've accumulated. Only writes if non-empty — an early interrupt
  // before any failures shouldn't clobber a file from a prior run.
  const shutdown = (signal: string): void => {
    console.log(`\n${signal} received — flushing state and exiting.`);
    if (failures.length > 0) {
      writeOrDeleteFailures(failures);
    }
    process.exit(130);
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  if (!args.workerOnly) {
    const t0 = Date.now();
    console.log(`\n[shortcut] running...`);
    const updated = await runShortcut(args.dryRun);
    console.log(
      `[shortcut] ${args.dryRun ? "would update" : "updated"}: ${updated} rows (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
    );
  }

  if (!args.shortcutOnly) {
    const t0 = Date.now();
    console.log(`\n[worker] starting loop...`);
    const result = await runWorkerLoop(
      {
        workerUrl: workerUrl!,
        secret: workerSecret!,
        batchSize: args.batchSize,
        dryRun: args.dryRun,
      },
      failures,
    );
    const elapsedSec = (Date.now() - t0) / 1000;
    console.log(
      `\n[worker] done: processed=${result.processed} updated=${result.updated} failures=${failures.length} (${elapsedSec.toFixed(1)}s)`,
    );
  }

  // Always flush failures at normal exit too — empties the file if the
  // run succeeded with zero failures, leaving a permanent record otherwise.
  writeOrDeleteFailures(failures);

  await dbClient.end();
  process.exit(0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error(
      "Fatal:",
      err instanceof Error ? `${err.message}\n${err.stack}` : err,
    );
    process.exit(1);
  });
}
