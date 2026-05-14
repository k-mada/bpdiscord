/**
 * HTTP handlers and DB helpers for /api/scrape-user — the per-user
 * /fetcher refresh entry point. Architecturally mirrors
 * refreshJobController.ts (the bulk Hater Rankings refresh) — both
 * delegate to the same shared core in jobHelpers.ts.
 *
 * Auth: any authenticated user (not admin-only). Per-user phase 3 writes
 * to the shared Films table, but the blast radius is small and bounded —
 * the same rows would be added by the next bulk refresh anyway. The
 * per-username partial unique index on user_scrape_jobs prevents the
 * same user from double-triggering; different usernames can scrape
 * concurrently.
 */

import { Request, Response } from "express";
import { eq } from "drizzle-orm";

import { db } from "../db";
import { users } from "../db/schema";
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

// Letterboxd usernames are alphanumeric + underscore/dash. Real rules cap
// at 30 chars; we cap at 50 to be permissive without permitting abusive
// payloads to reach the trigram patterns or the worker.
const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;
const USERNAME_MAX_LENGTH = 50;

// ===========================
// DB helpers (typed wrappers around shared jobHelpers internals)
// ===========================

export async function dbInsertRunningScrapeJob(
  startedBy: string,
  lbusername: string,
): Promise<InsertResult> {
  return insertRunningJob("user_scrape_jobs", { startedBy, lbusername });
}

export async function dbGetScrapeJob(jobId: string, startedBy?: string) {
  return getJob("user_scrape_jobs", jobId, startedBy);
}

export async function dbCancelScrapeJob(
  jobId: string,
  startedBy: string,
): Promise<CancelOutcome> {
  return cancelJob("user_scrape_jobs", jobId, startedBy);
}

export async function dbMarkScrapeJobFailed(
  jobId: string,
  message: string,
): Promise<void> {
  return markJobFailed("user_scrape_jobs", jobId, message);
}

// ===========================
// Worker handoff
// ===========================

async function callWorkerScrapeUser(
  config: WorkerConfig,
  jobId: string,
  lbusername: string,
): Promise<void> {
  return callWorker(config, "/scrape-user", { job_id: jobId, lbusername });
}

// ===========================
// Per-handler helpers
// ===========================

function getAuthedUserId(req: Request, res: Response): string | null {
  const id = req.user?.id;
  if (!id) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }
  return id;
}

/**
 * Two-layer username validation: format regex first (cheap, immediate
 * rejection), then a Users-table existence check (one PK lookup). Matches
 * today's /fetcher UX where the dropdown is sourced from the Users table —
 * arbitrary strings shouldn't trigger scrape jobs.
 *
 * Letterboxd-existence is the third defense, implicit at moviemaestro
 * phase 1: letterboxdpy raises if the profile is gone. That failure lands
 * in errors[] but consumes a job slot.
 */
async function validateUsername(
  raw: string | undefined,
  res: Response,
): Promise<string | null> {
  if (!raw) {
    res.status(400).json({ error: "username is required" });
    return null;
  }
  const username = raw.trim();
  if (!USERNAME_REGEX.test(username) || username.length > USERNAME_MAX_LENGTH) {
    res.status(400).json({
      error: "Invalid username — expected alphanumeric, underscore, or dash",
    });
    return null;
  }
  const existing = await db
    .select({ lbusername: users.lbusername })
    .from(users)
    .where(eq(users.lbusername, username))
    .limit(1);
  if (existing.length === 0) {
    res.status(404).json({ error: "User not found" });
    return null;
  }
  return username;
}

// ===========================
// HTTP handlers
// ===========================

export async function triggerScrapeUser(
  req: Request,
  res: Response,
): Promise<void> {
  const startedBy = getAuthedUserId(req, res);
  if (!startedBy) return;

  const lbusername = await validateUsername(req.params.username, res);
  if (!lbusername) return;

  // Fail fast on misconfigured deployment BEFORE inserting a row.
  const workerConfig = getWorkerConfig();
  if (!workerConfig) {
    console.error(
      "triggerScrapeUser: WORKER_URL or WORKER_SHARED_SECRET not configured",
    );
    res.status(500).json({ error: "Worker not configured" });
    return;
  }

  let insertResult: InsertResult;
  try {
    insertResult = await dbInsertRunningScrapeJob(startedBy, lbusername);
  } catch (e) {
    console.error("triggerScrapeUser: insert failed", e);
    res.status(500).json({ error: "Failed to create scrape job" });
    return;
  }

  if (!insertResult.ok) {
    res.status(409).json({
      error: `A scrape job for ${lbusername} is already running`,
      data: { existing_job_id: insertResult.conflictWithJobId },
    });
    return;
  }

  const jobId = insertResult.jobId;

  try {
    await callWorkerScrapeUser(workerConfig, jobId, lbusername);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(
      `triggerScrapeUser: worker handoff failed for ${jobId}: ${message}`,
    );
    try {
      await dbMarkScrapeJobFailed(jobId, `worker handoff failed: ${message}`);
    } catch (rollbackErr) {
      console.error("triggerScrapeUser: rollback also failed", rollbackErr);
    }
    res.status(502).json({
      error: "Worker unreachable; job rolled back",
      details: message,
    });
    return;
  }

  res.status(202).json({ data: { job_id: jobId } });
}

export async function getScrapeJob(
  req: Request,
  res: Response,
): Promise<void> {
  const startedBy = getAuthedUserId(req, res);
  if (!startedBy) return;
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "id is required" });
    return;
  }

  const job = await dbGetScrapeJob(id, startedBy);
  if (!job) {
    res.status(404).json({ error: "Job not found" });
    return;
  }
  res.json({ data: job });
}

export async function cancelScrapeJob(
  req: Request,
  res: Response,
): Promise<void> {
  const startedBy = getAuthedUserId(req, res);
  if (!startedBy) return;
  const id = req.params.id;
  if (!id) {
    res.status(400).json({ error: "id is required" });
    return;
  }

  const outcome = await dbCancelScrapeJob(id, startedBy);
  if (outcome === "cancelled") {
    res.json({ data: { id, status: "cancelled" } });
    return;
  }
  if (outcome === "not_running") {
    res
      .status(409)
      .json({ error: "Job is not running and cannot be cancelled" });
    return;
  }
  res.status(404).json({ error: "Job not found" });
}
