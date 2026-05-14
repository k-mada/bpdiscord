/**
 * Shared DB + worker-handoff helpers for refresh_jobs and user_scrape_jobs.
 *
 * The two tables drive structurally identical orchestrator pipelines (bulk
 * Hater Rankings refresh vs. per-user /fetcher refresh). Keeping the helpers
 * in one place means single-flight detection, conflict resolution, cancel
 * semantics, and worker-handoff retry behavior live exactly once — any bug
 * fix to (say) the 23505 classification automatically applies to both flows.
 *
 * The exported functions take a JobTable discriminator and dispatch to the
 * right Drizzle table at runtime. The `any` casts inside are unavoidable —
 * Drizzle's pgTable types are nominally distinct per table, and the helpers
 * are inherently polymorphic. The thin per-table wrappers in
 * refreshJobController.ts and userScrapeJobController.ts re-impose the
 * typed public API.
 */

import { and, eq, sql } from "drizzle-orm";

import { db } from "../db";
import { refreshJobs, userScrapeJobs } from "../db/schema";

export type JobTable = "refresh_jobs" | "user_scrape_jobs";

const TABLE_BY_NAME = {
  refresh_jobs: refreshJobs,
  user_scrape_jobs: userScrapeJobs,
} as const;

// Constraint names from the migrations — must match exactly for the 23505
// classification to fire on the right unique violation.
const RUNNING_CONSTRAINT: Record<JobTable, string> = {
  refresh_jobs: "refresh_jobs_one_running",
  user_scrape_jobs: "user_scrape_jobs_one_running_per_user",
};

// Columns that scope the conflicting-row lookup. refresh_jobs is globally
// single-flight (any running row conflicts); user_scrape_jobs is single-
// flight per username, so we filter by lbusername to find the right row.
const CONFLICT_FILTER_COLUMNS: Record<JobTable, readonly string[]> = {
  refresh_jobs: [],
  user_scrape_jobs: ["lbusername"],
};

export type InsertResult =
  | { ok: true; jobId: string }
  | { ok: false; conflictWithJobId: string };

export type CancelOutcome = "cancelled" | "not_running" | "not_found";

export interface WorkerConfig {
  url: string;
  sharedSecret: string;
}

const WORKER_FETCH_TIMEOUT_MS = 10_000;

// ===========================
// DB helpers
// ===========================

/**
 * Insert a fresh job row in 'running' state. On the partial unique index
 * violation (23505), returns the existing running row's id instead so the
 * caller can surface it as a 409 with a resumable job_id.
 *
 * `fields` is merged with `{status: 'running'}` and inserted. For
 * user_scrape_jobs it MUST include `lbusername`; for refresh_jobs it
 * doesn't need to.
 */
export async function insertRunningJob(
  table: JobTable,
  fields: Record<string, unknown>,
): Promise<InsertResult> {
  const tableRef = TABLE_BY_NAME[table];
  try {
    const inserted = await db
      // Drizzle's typed union for the two tables doesn't narrow well at
      // runtime dispatch — cast at the seam, then trust the schema.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .insert(tableRef as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .values({ status: "running", ...fields } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .returning({ id: (tableRef as any).id });
    const row = inserted[0];
    if (!row) throw new Error("INSERT ... RETURNING produced no rows");
    return { ok: true, jobId: row.id };
  } catch (e: unknown) {
    if (!isUniqueViolationOnRunningIndex(e, table)) throw e;

    // Find the row holding the lock so the caller can return it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = tableRef as any;
    const filters = [eq(t.status, "running")];
    for (const col of CONFLICT_FILTER_COLUMNS[table]) {
      filters.push(eq(t[col], fields[col]));
    }
    const existing = await db
      .select({ id: t.id })
      .from(t)
      .where(and(...filters))
      .limit(1);
    const existingRow = existing[0];
    if (!existingRow) throw e; // unique violation but no row found — shouldn't happen
    return { ok: false, conflictWithJobId: existingRow.id };
  }
}

/**
 * Read a job. Optional `startedBy` enforces own-only access — pass
 * req.user.id so callers respect per-user scope. A row that exists but
 * belongs to another user is returned as null (don't leak existence).
 */
export async function getJob(
  table: JobTable,
  jobId: string,
  startedBy?: string,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = TABLE_BY_NAME[table] as any;
  const where = startedBy
    ? and(eq(t.id, jobId), eq(t.startedBy, startedBy))
    : eq(t.id, jobId);
  const rows = await db.select().from(t).where(where).limit(1);
  return rows[0] ?? null;
}

/**
 * Cancel a running job started by `startedBy`. The WHERE clause guards on
 * status so completed/failed jobs aren't reopened, and on started_by so
 * one user can't cancel another's job. Distinguishes 'no such job for you'
 * from 'exists but not running' so the API can return clear status codes.
 */
export async function cancelJob(
  table: JobTable,
  jobId: string,
  startedBy: string,
): Promise<CancelOutcome> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = TABLE_BY_NAME[table] as any;
  const updated = await db
    .update(t)
    .set({ status: "cancelled", finishedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(t.id, jobId),
        eq(t.startedBy, startedBy),
        eq(t.status, "running"),
      ),
    )
    .returning({ id: t.id });
  if (updated.length > 0) return "cancelled";

  const exists = await getJob(table, jobId, startedBy);
  return exists ? "not_running" : "not_found";
}

/**
 * Roll back a row we just inserted if the worker handoff failed. Only
 * touches 'running' rows so we never clobber a worker that raced ahead
 * (it'd be writing 'completed'/'failed' itself). Appends a synthetic error
 * entry so the UI can show what went wrong.
 */
export async function markJobFailed(
  table: JobTable,
  jobId: string,
  message: string,
): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const t = TABLE_BY_NAME[table] as any;
  const errorEntry = {
    phase: "trigger",
    item: null,
    error: message,
    at: new Date().toISOString(),
  };
  await db
    .update(t)
    .set({
      status: "failed",
      finishedAt: new Date(),
      updatedAt: new Date(),
      errors: sql`COALESCE(${t.errors}, '[]'::jsonb) || ${JSON.stringify([errorEntry])}::jsonb`,
    })
    .where(and(eq(t.id, jobId), eq(t.status, "running")));
}

// ===========================
// Worker handoff
// ===========================

/**
 * Read worker config from env. Returns null if either var is missing so
 * the caller can fail fast BEFORE inserting a row.
 */
export function getWorkerConfig(): WorkerConfig | null {
  const url = process.env.WORKER_URL;
  const sharedSecret = process.env.WORKER_SHARED_SECRET;
  if (!url || !sharedSecret) return null;
  return { url, sharedSecret };
}

/**
 * Fire-and-forget POST to the moviemaestro worker. Times out after
 * WORKER_FETCH_TIMEOUT_MS; on any non-2xx, throws so the caller can roll
 * back the row via markJobFailed.
 */
export async function callWorker(
  config: WorkerConfig,
  endpoint: "/start" | "/scrape-user",
  body: Record<string, unknown>,
): Promise<void> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WORKER_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${config.url}${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.sharedSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(
        `worker ${endpoint} returned ${res.status}: ${text.slice(0, 200)}`,
      );
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ===========================
// Internal: 23505 classifier
// ===========================

function isUniqueViolationOnRunningIndex(e: unknown, table: JobTable): boolean {
  const expected = RUNNING_CONSTRAINT[table];
  // Drizzle wraps postgres-js errors in `cause`. Check both.
  const candidates = [e, (e as { cause?: unknown })?.cause];
  for (const c of candidates) {
    if (typeof c !== "object" || c === null) continue;
    const err = c as Record<string, unknown>;
    if (err.code === "23505" && err.constraint_name === expected) {
      return true;
    }
  }
  return false;
}
