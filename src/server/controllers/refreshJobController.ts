import { Request, Response } from "express";

import {
  type CancelOutcome,
  type InsertResult,
  type WorkerConfig,
  callWorker,
  cancelJob,
  getJob,
  getWorkerConfig,
  insertRunningJob,
  markJobFailed,
} from "./jobHelpers";

// ===========================
// DB helpers (exported for tests — thin, typed wrappers around the
// shared helpers in jobHelpers.ts. The bulk path has no extra fields
// beyond started_by, so the API stays {startedBy: string} → InsertResult.)
// ===========================

export type { InsertResult, CancelOutcome };

export async function dbInsertRunningJob(startedBy: string): Promise<InsertResult> {
  return insertRunningJob("refresh_jobs", { startedBy });
}

export async function dbGetJob(jobId: string, startedBy?: string) {
  return getJob("refresh_jobs", jobId, startedBy);
}

export async function dbCancelJob(jobId: string, startedBy: string): Promise<CancelOutcome> {
  return cancelJob("refresh_jobs", jobId, startedBy);
}

export async function dbMarkJobFailed(jobId: string, message: string): Promise<void> {
  return markJobFailed("refresh_jobs", jobId, message);
}

// ===========================
// Worker handoff
// ===========================

async function callWorkerStart(config: WorkerConfig, jobId: string): Promise<void> {
  return callWorker(config, "/start", { job_id: jobId });
}

// ===========================
// Per-handler helpers
// ===========================

/**
 * Resolve the authenticated user id, or send a 401 and return null. Defense
 * in depth — `authenticateToken` should have already populated req.user, but
 * we don't want a misconfigured route to write rows under a missing identity.
 */
function getAuthedUserId(req: Request, res: Response): string | null {
  const id = req.user?.id;
  if (!id) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return id;
}

// ===========================
// HTTP handlers
// ===========================

export async function triggerRefresh(req: Request, res: Response): Promise<void> {
  const startedBy = getAuthedUserId(req, res);
  if (!startedBy) return;

  // Fail fast on misconfigured deployment BEFORE inserting a row, so we don't
  // cycle a row through running → failed every trigger when env is missing.
  const workerConfig = getWorkerConfig();
  if (!workerConfig) {
    console.error("triggerRefresh: WORKER_URL or WORKER_SHARED_SECRET not configured");
    res.status(500).json({ error: "Worker not configured" });
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
      data: { existing_job_id: insertResult.conflictWithJobId },
    });
    return;
  }

  const jobId = insertResult.jobId;

  try {
    await callWorkerStart(workerConfig, jobId);
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

  res.status(202).json({ data: { job_id: jobId } });
}

export async function getRefreshJob(req: Request, res: Response): Promise<void> {
  const startedBy = getAuthedUserId(req, res);
  if (!startedBy) return;
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
  res.json({ data: job });
}

export async function cancelRefreshJob(req: Request, res: Response): Promise<void> {
  const startedBy = getAuthedUserId(req, res);
  if (!startedBy) return;
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "id is required" });
    return;
  }

  const outcome = await dbCancelJob(id, startedBy);
  if (outcome === "cancelled") {
    res.json({ data: { id, status: "cancelled" } });
    return;
  }
  if (outcome === "not_running") {
    res.status(409).json({ error: "Job is not running and cannot be cancelled" });
    return;
  }
  res.status(404).json({ error: "Job not found" });
}
