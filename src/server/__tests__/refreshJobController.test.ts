/**
 * Integration tests for refreshJobController.ts
 *
 * Covers DB helpers (single-flight insert, own-only get/cancel, atomic
 * mark-failed). HTTP handler tests are deferred — the codebase has no fetch-
 * mocking precedent, so the worker handoff is smoke-tested live.
 *
 * Run with: NODE_ENV=test yarn test
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";

import {
  dbCancelJob,
  dbGetJob,
  dbInsertRunningJob,
  dbMarkJobFailed,
} from "../controllers/refreshJobController";
import { db } from "../db";
import { refreshJobs } from "../db/schema";
import { eq } from "drizzle-orm";

import { assertTestEnvironment, cleanDatabase, closeDatabase } from "./setup";

const ALICE = "11111111-1111-1111-1111-111111111111";
const BOB = "22222222-2222-2222-2222-222222222222";

beforeAll(() => {
  assertTestEnvironment();
});

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

// Convenience: read a row directly so we can assert state the helpers don't expose.
async function readRow(jobId: string) {
  const r = await db.select().from(refreshJobs).where(eq(refreshJobs.id, jobId));
  return r[0] ?? null;
}

// ===========================
// dbInsertRunningJob
// ===========================

describe("dbInsertRunningJob", () => {
  it("returns ok with a new id when no job is running", async () => {
    const result = await dbInsertRunningJob(ALICE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.jobId).toMatch(/^[0-9a-f-]{36}$/);

    const row = await readRow(result.jobId);
    expect(row?.status).toBe("running");
    expect(row?.startedBy).toBe(ALICE);
    expect(row?.finishedAt).toBeNull();
  });

  it("returns conflict with the existing id when a job is already running", async () => {
    const first = await dbInsertRunningJob(ALICE);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    // Even a different user's attempt collides — the partial unique index is
    // global (one running job in the system), not per-user.
    const second = await dbInsertRunningJob(BOB);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.conflictWithJobId).toBe(first.jobId);
  });

  it("succeeds again after the previous job is cancelled", async () => {
    const first = await dbInsertRunningJob(ALICE);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    await dbCancelJob(first.jobId, ALICE);

    const second = await dbInsertRunningJob(ALICE);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.jobId).not.toBe(first.jobId);
  });

  it("succeeds again after the previous job is marked failed", async () => {
    const first = await dbInsertRunningJob(ALICE);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    await dbMarkJobFailed(first.jobId, "test rollback");

    const second = await dbInsertRunningJob(ALICE);
    expect(second.ok).toBe(true);
  });
});

// ===========================
// dbGetJob — own-only enforcement
// ===========================

describe("dbGetJob", () => {
  it("returns the row for its owner", async () => {
    const ins = await dbInsertRunningJob(ALICE);
    if (!ins.ok) throw new Error("seed failed");

    const row = await dbGetJob(ins.jobId, ALICE);
    expect(row).not.toBeNull();
    expect(row?.id).toBe(ins.jobId);
    expect(row?.startedBy).toBe(ALICE);
  });

  it("returns null when accessed by a different user (don't leak existence)", async () => {
    const ins = await dbInsertRunningJob(ALICE);
    if (!ins.ok) throw new Error("seed failed");

    const row = await dbGetJob(ins.jobId, BOB);
    expect(row).toBeNull();
  });

  it("returns null for a non-existent id", async () => {
    const row = await dbGetJob("00000000-0000-0000-0000-000000000000", ALICE);
    expect(row).toBeNull();
  });

  it("returns the row when no startedBy filter is provided (admin/test path)", async () => {
    const ins = await dbInsertRunningJob(ALICE);
    if (!ins.ok) throw new Error("seed failed");

    const row = await dbGetJob(ins.jobId);
    expect(row).not.toBeNull();
    expect(row?.id).toBe(ins.jobId);
  });
});

// ===========================
// dbCancelJob
// ===========================

describe("dbCancelJob", () => {
  it("flips status to cancelled and stamps finished_at for own running job", async () => {
    const ins = await dbInsertRunningJob(ALICE);
    if (!ins.ok) throw new Error("seed failed");

    const outcome = await dbCancelJob(ins.jobId, ALICE);
    expect(outcome).toBe("cancelled");

    const row = await readRow(ins.jobId);
    expect(row?.status).toBe("cancelled");
    expect(row?.finishedAt).not.toBeNull();
  });

  it("refuses to cancel another user's job (returns not_found, not_not_running)", async () => {
    const ins = await dbInsertRunningJob(ALICE);
    if (!ins.ok) throw new Error("seed failed");

    const outcome = await dbCancelJob(ins.jobId, BOB);
    // Same response as a missing job — don't leak that the row exists.
    expect(outcome).toBe("not_found");

    // And the original row is untouched.
    const row = await readRow(ins.jobId);
    expect(row?.status).toBe("running");
  });

  it("returns not_running for a job that already completed", async () => {
    const ins = await dbInsertRunningJob(ALICE);
    if (!ins.ok) throw new Error("seed failed");
    // Simulate the worker completing.
    await db
      .update(refreshJobs)
      .set({ status: "completed", finishedAt: new Date() })
      .where(eq(refreshJobs.id, ins.jobId));

    const outcome = await dbCancelJob(ins.jobId, ALICE);
    expect(outcome).toBe("not_running");

    const row = await readRow(ins.jobId);
    expect(row?.status).toBe("completed"); // unchanged
  });

  it("returns not_found for a non-existent id", async () => {
    const outcome = await dbCancelJob(
      "00000000-0000-0000-0000-000000000000",
      ALICE,
    );
    expect(outcome).toBe("not_found");
  });
});

// ===========================
// dbMarkJobFailed
// ===========================

describe("dbMarkJobFailed", () => {
  it("flips status to failed and appends the message to errors[]", async () => {
    const ins = await dbInsertRunningJob(ALICE);
    if (!ins.ok) throw new Error("seed failed");

    await dbMarkJobFailed(ins.jobId, "worker timeout");

    const row = await readRow(ins.jobId);
    expect(row?.status).toBe("failed");
    expect(row?.finishedAt).not.toBeNull();
    const errs = row?.errors as Array<{ phase: string; error: string }>;
    expect(errs.length).toBeGreaterThan(0);
    expect(errs[errs.length - 1].error).toContain("worker timeout");
  });

  it("does not touch a completed job (defensive — never clobber worker terminal state)", async () => {
    const ins = await dbInsertRunningJob(ALICE);
    if (!ins.ok) throw new Error("seed failed");
    await db
      .update(refreshJobs)
      .set({ status: "completed", finishedAt: new Date() })
      .where(eq(refreshJobs.id, ins.jobId));

    await dbMarkJobFailed(ins.jobId, "should be ignored");

    const row = await readRow(ins.jobId);
    expect(row?.status).toBe("completed");
  });

  it("preserves existing errors when appending", async () => {
    const ins = await dbInsertRunningJob(ALICE);
    if (!ins.ok) throw new Error("seed failed");
    // Pre-populate with one error entry to verify append semantics.
    const existing = [{ phase: "user_scrape", item: "alice", error: "boom", at: "2026-05-10T00:00:00Z" }];
    await db
      .update(refreshJobs)
      .set({ errors: existing })
      .where(eq(refreshJobs.id, ins.jobId));

    await dbMarkJobFailed(ins.jobId, "second failure");

    const row = await readRow(ins.jobId);
    const errs = row?.errors as Array<{ phase: string; error: string }>;
    expect(errs.length).toBe(2);
    expect(errs[0].item).toBe("alice");
    expect(errs[1].error).toContain("second failure");
  });
});
