import { Request, Response } from "express";
import { and, eq, sql } from "drizzle-orm";

import { db } from "../db";
import { refreshJobs } from "../db/schema";

// ===========================
// Constants
// ===========================

const WORKER_FETCH_TIMEOUT_MS = 2000;
// Single-flight is enforced by the partial unique index defined in
// supabase/migrations/20260510024837_add_refresh_jobs.sql. Match the name
// exactly — code-only check would also catch unrelated future unique indexes.
const RUNNING_INDEX_NAME = "refresh_jobs_one_running";

// ===========================
// DB helpers (exported for tests)
// ===========================

export type InsertResult =
  | { ok: true; jobId: string }
  | { ok: false; conflictWithJobId: string };

/**
 * Insert a fresh refresh_jobs row in 'running' state. On the partial unique
 * index violation, returns the existing running row's id instead.
 */
export async function dbInsertRunningJob(startedBy: string): Promise<InsertResult> {
  try {
    const inserted = await db
      .insert(refreshJobs)
      .values({ status: "running", startedBy })
      .returning({ id: refreshJobs.id });
    const row = inserted[0];
    if (!row) throw new Error("INSERT ... RETURNING produced no rows");
    return { ok: true, jobId: row.id };
  } catch (e: unknown) {
    if (isUniqueViolationOnRunningIndex(e)) {
      // Find the existing row that holds the lock so the caller can return it.
      const existing = await db
        .select({ id: refreshJobs.id })
        .from(refreshJobs)
        .where(eq(refreshJobs.status, "running"))
        .limit(1);
      const existingRow = existing[0];
      if (!existingRow) {
        // Should be unreachable — the violation means a row exists. Fall through.
        throw e;
      }
      return { ok: false, conflictWithJobId: existingRow.id };
    }
    throw e;
  }
}

/**
 * Read a job. Optional `startedBy` enforces own-only access — pass req.user.id
 * here so callers automatically respect the per-user scope. A row that exists
 * but belongs to another user is returned as null (don't leak existence).
 */
export async function dbGetJob(jobId: string, startedBy?: string) {
  const where = startedBy
    ? and(eq(refreshJobs.id, jobId), eq(refreshJobs.startedBy, startedBy))
    : eq(refreshJobs.id, jobId);
  const rows = await db.select().from(refreshJobs).where(where).limit(1);
  return rows[0] ?? null;
}

export type CancelOutcome = "cancelled" | "not_running" | "not_found";

/**
 * Cancel a running job started by `startedBy`. The where-clause guards on
 * status so completed/failed jobs aren't reopened, and on started_by so admins
 * can't cancel each other's jobs. Distinguishes 'no such job for you' from
 * 'exists but not running' so the API can return clear status codes.
 */
export async function dbCancelJob(jobId: string, startedBy: string): Promise<CancelOutcome> {
  const updated = await db
    .update(refreshJobs)
    .set({ status: "cancelled", finishedAt: new Date(), updatedAt: new Date() })
    .where(
      and(
        eq(refreshJobs.id, jobId),
        eq(refreshJobs.startedBy, startedBy),
        eq(refreshJobs.status, "running"),
      ),
    )
    .returning({ id: refreshJobs.id });
  if (updated.length > 0) return "cancelled";

  // Distinguish missing/forbidden from exists-but-not-running.
  const exists = await dbGetJob(jobId, startedBy);
  return exists ? "not_running" : "not_found";
}

/**
 * Roll back a row we just inserted if the worker handoff failed. Only touches
 * 'running' rows so we never clobber a worker that raced ahead. Appends a
 * synthetic error entry so the UI can show what went wrong.
 */
export async function dbMarkJobFailed(jobId: string, message: string): Promise<void> {
  const errorEntry = { phase: "trigger", item: null, error: message, at: new Date().toISOString() };
  await db
    .update(refreshJobs)
    .set({
      status: "failed",
      finishedAt: new Date(),
      updatedAt: new Date(),
      // Append to the errors jsonb array using a SQL coalesce + ||.
      errors: sql`COALESCE(${refreshJobs.errors}, '[]'::jsonb) || ${JSON.stringify([errorEntry])}::jsonb`,
    })
    .where(and(eq(refreshJobs.id, jobId), eq(refreshJobs.status, "running")));
}

// ===========================
// Worker handoff
// ===========================

async function callWorkerStart(jobId: string): Promise<void> {
  const workerUrl = process.env.WORKER_URL;
  const sharedSecret = process.env.WORKER_SHARED_SECRET;
  if (!workerUrl || !sharedSecret) {
    throw new Error("WORKER_URL or WORKER_SHARED_SECRET not configured");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), WORKER_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${workerUrl}/start`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${sharedSecret}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ job_id: jobId }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`worker /start returned ${res.status}: ${body.slice(0, 200)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

// ===========================
// HTTP handlers
// ===========================

export async function triggerRefresh(req: Request, res: Response): Promise<void> {
  const startedBy = req.user?.id;
  if (!startedBy) {
    // authenticateToken should have already 401'd; defense in depth.
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  let insertResult: InsertResult;
  try {
    insertResult = await dbInsertRunningJob(startedBy);
  } catch (e) {
    console.error("triggerRefresh: insert failed", e);
    res.status(500).json({ error: "Failed to create refresh job" });
    return;
  }

  if (!insertResult.ok) {
    res.status(409).json({
      error: "Another refresh job is already running",
      existing_job_id: insertResult.conflictWithJobId,
    });
    return;
  }

  const jobId = insertResult.jobId;

  try {
    await callWorkerStart(jobId);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`triggerRefresh: worker handoff failed for ${jobId}: ${message}`);
    // Atomic rollback: mark the row failed so the next trigger can succeed.
    try {
      await dbMarkJobFailed(jobId, `worker handoff failed: ${message}`);
    } catch (rollbackErr) {
      console.error("triggerRefresh: rollback also failed", rollbackErr);
    }
    res.status(502).json({
      error: "Worker unreachable; job rolled back",
      details: message,
    });
    return;
  }

  res.status(202).json({ job_id: jobId });
}

export async function getRefreshJob(req: Request, res: Response): Promise<void> {
  const startedBy = req.user?.id;
  if (!startedBy) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "id is required" });
    return;
  }

  const job = await dbGetJob(id, startedBy);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json(job);
}

export async function cancelRefreshJob(req: Request, res: Response): Promise<void> {
  const startedBy = req.user?.id;
  if (!startedBy) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "id is required" });
    return;
  }

  const outcome = await dbCancelJob(id, startedBy);
  if (outcome === "cancelled") {
    res.json({ id, status: "cancelled" });
    return;
  }
  if (outcome === "not_running") {
    res.status(409).json({ error: "Job is not running and cannot be cancelled" });
    return;
  }
  res.status(404).json({ error: "Job not found" });
}

// ===========================
// Internal: error type guard
// ===========================

function isUniqueViolationOnRunningIndex(e: unknown): boolean {
  // Drizzle wraps the underlying postgres-js error as `cause`. Check both the
  // outer error and the cause so this works whether we get a raw PostgresError
  // or a Drizzle DrizzleQueryError that carries it.
  const candidates = [e, (e as { cause?: unknown })?.cause];
  for (const c of candidates) {
    if (typeof c !== "object" || c === null) continue;
    const err = c as Record<string, unknown>;
    if (err.code === "23505" && err.constraint_name === RUNNING_INDEX_NAME) {
      return true;
    }
  }
  return false;
}
