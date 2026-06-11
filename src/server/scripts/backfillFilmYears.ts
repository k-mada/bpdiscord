import "dotenv/config";
import * as readline from "readline";
import axios, { AxiosError } from "axios";
import { sql } from "drizzle-orm";
import { db, dbClient } from "../db";

interface Args {
  dryRun: boolean;
  shortcutOnly: boolean;
  workerOnly: boolean;
  batchSize: number;
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

// Sentinel used to force a transaction rollback for --dry-run without
// signalling a real error to the surrounding try/catch.
class DryRunRollback extends Error {}

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

  let count = 0;
  try {
    await db.transaction(async (tx) => {
      const rows = await tx.execute(stmt);
      count = rows.length;
      throw new DryRunRollback();
    });
  } catch (e) {
    if (!(e instanceof DryRunRollback)) throw e;
  }
  return count;
}

interface WorkerBatchResp {
  processed: number;
  updated: number;
  failures: Array<{ film_slug: string; error: string }>;
}

async function callWorker(args: {
  workerUrl: string;
  secret: string;
  batchSize: number;
  dryRun: boolean;
}): Promise<WorkerBatchResp> {
  const url = `${args.workerUrl.replace(/\/+$/, "")}/backfill-film-years`;
  const resp = await axios.post<WorkerBatchResp>(
    url,
    { batch_size: args.batchSize, dry_run: args.dryRun },
    {
      headers: { Authorization: `Bearer ${args.secret}` },
      timeout: 120_000,
    },
  );
  return resp.data;
}

async function runWorkerLoop(args: {
  workerUrl: string;
  secret: string;
  batchSize: number;
  dryRun: boolean;
}): Promise<{ processed: number; updated: number; failureCount: number }> {
  let processed = 0;
  let updated = 0;
  let failureCount = 0;
  let iter = 0;

  while (true) {
    iter++;
    let resp: WorkerBatchResp;
    try {
      resp = await callWorker(args);
    } catch (e) {
      const err = e as AxiosError;
      console.error(
        `[worker] batch ${iter} failed: ${err.message} (status ${err.response?.status ?? "?"})`,
      );
      throw err;
    }

    processed += resp.processed;
    updated += resp.updated;
    failureCount += resp.failures.length;

    console.log(
      `[worker] batch ${iter}: processed=${resp.processed} updated=${resp.updated} failures=${resp.failures.length} (cumulative processed=${processed} updated=${updated})`,
    );

    for (const f of resp.failures) {
      console.error(`  ! ${f.film_slug}: ${f.error}`);
    }

    // Dry-run never drains the NULL pool, so a `processed === 0` stop
    // condition would never fire. Stop after one batch.
    if (args.dryRun) {
      console.log(`[worker] dry-run: stopping after first batch`);
      break;
    }

    if (resp.processed === 0) break;
  }

  return { processed, updated, failureCount };
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  const workerUrl = process.env.WORKER_URL;
  const workerSecret = process.env.WORKER_SHARED_SECRET;
  if (!args.shortcutOnly && (!workerUrl || !workerSecret)) {
    console.error(
      "WORKER_URL and WORKER_SHARED_SECRET are required for the worker phase",
    );
    process.exit(1);
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

  if (!args.workerOnly) {
    console.log(`\n[shortcut] running...`);
    const updated = await runShortcut(args.dryRun);
    console.log(
      `[shortcut] ${args.dryRun ? "would update" : "updated"}: ${updated} rows`,
    );
  }

  if (!args.shortcutOnly) {
    console.log(`\n[worker] starting loop...`);
    const result = await runWorkerLoop({
      workerUrl: workerUrl!,
      secret: workerSecret!,
      batchSize: args.batchSize,
      dryRun: args.dryRun,
    });
    console.log(
      `\n[worker] done: processed=${result.processed} updated=${result.updated} failures=${result.failureCount}`,
    );
  }

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
