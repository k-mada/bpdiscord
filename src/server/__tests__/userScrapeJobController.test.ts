/**
 * Integration tests for userScrapeJobController.ts
 *
 * Mirrors refreshJobController.test.ts but exercises the per-user code
 * paths: per-username single-flight, conflict-by-username resolution,
 * own-only access for the get/cancel paths.
 *
 * Run with: NODE_ENV=test yarn test
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";

import {
  dbCancelScrapeJob,
  dbGetScrapeJob,
  dbInsertRunningScrapeJob,
  dbMarkScrapeJobFailed,
} from "../controllers/userScrapeJobController";
import { db } from "../db";
import { userScrapeJobs, users } from "../db/schema";

import { assertTestEnvironment, cleanDatabase, closeDatabase } from "./setup";

const ALICE_AUTH = "11111111-1111-1111-1111-111111111111";
const BOB_AUTH = "22222222-2222-2222-2222-222222222222";
const LB_ALICE = "alice_lb";
const LB_BOB = "bob_lb";

beforeAll(() => {
  assertTestEnvironment();
});

beforeEach(async () => {
  await cleanDatabase();
  // Seed Users — the trigger handler does an existence check, and several
  // helpers do too transitively.
  await db
    .insert(users)
    .values([
      { lbusername: LB_ALICE, isDiscord: true },
      { lbusername: LB_BOB, isDiscord: true },
    ]);
});

afterAll(async () => {
  await closeDatabase();
});

async function readRow(jobId: string) {
  const r = await db
    .select()
    .from(userScrapeJobs)
    .where(eq(userScrapeJobs.id, jobId));
  return r[0] ?? null;
}

// ===========================
// dbInsertRunningScrapeJob — single-flight is PER-USERNAME (not global)
// ===========================

describe("dbInsertRunningScrapeJob", () => {
  it("returns ok with a new id when no job is running for this user", async () => {
    const result = await dbInsertRunningScrapeJob(ALICE_AUTH, LB_ALICE);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.jobId).toMatch(/^[0-9a-f-]{36}$/);

    const row = await readRow(result.jobId);
    expect(row?.status).toBe("running");
    expect(row?.startedBy).toBe(ALICE_AUTH);
    expect(row?.lbusername).toBe(LB_ALICE);
    expect(row?.finishedAt).toBeNull();
  });

  it("returns conflict with the existing id when the SAME user is already running", async () => {
    const first = await dbInsertRunningScrapeJob(ALICE_AUTH, LB_ALICE);
    expect(first.ok).toBe(true);
    if (!first.ok) return;

    const second = await dbInsertRunningScrapeJob(BOB_AUTH, LB_ALICE);
    expect(second.ok).toBe(false);
    if (second.ok) return;
    expect(second.conflictWithJobId).toBe(first.jobId);
  });

  it("allows DIFFERENT users to scrape concurrently (per-username single-flight)", async () => {
    // The critical difference from refresh_jobs: single-flight here is
    // per-username, not global. /fetcher must support concurrent
    // scrapes for different users.
    const aliceJob = await dbInsertRunningScrapeJob(ALICE_AUTH, LB_ALICE);
    const bobJob = await dbInsertRunningScrapeJob(BOB_AUTH, LB_BOB);

    expect(aliceJob.ok).toBe(true);
    expect(bobJob.ok).toBe(true);
    if (!aliceJob.ok || !bobJob.ok) return;
    expect(aliceJob.jobId).not.toBe(bobJob.jobId);

    const rows = await db
      .select()
      .from(userScrapeJobs)
      .where(eq(userScrapeJobs.status, "running"));
    expect(rows.length).toBe(2);
  });

  it("succeeds again for the same user after the previous job is cancelled", async () => {
    const first = await dbInsertRunningScrapeJob(ALICE_AUTH, LB_ALICE);
    if (!first.ok) throw new Error("seed failed");

    await dbCancelScrapeJob(first.jobId, ALICE_AUTH);

    const second = await dbInsertRunningScrapeJob(ALICE_AUTH, LB_ALICE);
    expect(second.ok).toBe(true);
    if (!second.ok) return;
    expect(second.jobId).not.toBe(first.jobId);
  });

  it("succeeds again after the previous job is marked failed", async () => {
    const first = await dbInsertRunningScrapeJob(ALICE_AUTH, LB_ALICE);
    if (!first.ok) throw new Error("seed failed");

    await dbMarkScrapeJobFailed(first.jobId, "test rollback");

    const second = await dbInsertRunningScrapeJob(ALICE_AUTH, LB_ALICE);
    expect(second.ok).toBe(true);
  });
});

// ===========================
// dbGetScrapeJob — own-only enforcement
// ===========================

describe("dbGetScrapeJob", () => {
  it("returns the row for its owner", async () => {
    const ins = await dbInsertRunningScrapeJob(ALICE_AUTH, LB_ALICE);
    if (!ins.ok) throw new Error("seed failed");

    const row = await dbGetScrapeJob(ins.jobId, ALICE_AUTH);
    expect(row).not.toBeNull();
    expect(row?.id).toBe(ins.jobId);
    expect(row?.startedBy).toBe(ALICE_AUTH);
    expect(row?.lbusername).toBe(LB_ALICE);
  });

  it("returns null when accessed by a different user (don't leak existence)", async () => {
    const ins = await dbInsertRunningScrapeJob(ALICE_AUTH, LB_ALICE);
    if (!ins.ok) throw new Error("seed failed");

    const row = await dbGetScrapeJob(ins.jobId, BOB_AUTH);
    expect(row).toBeNull();
  });

  it("returns null for a non-existent id", async () => {
    const row = await dbGetScrapeJob(
      "00000000-0000-0000-0000-000000000000",
      ALICE_AUTH,
    );
    expect(row).toBeNull();
  });
});

// ===========================
// dbCancelScrapeJob
// ===========================

describe("dbCancelScrapeJob", () => {
  it("flips status to cancelled for own running job", async () => {
    const ins = await dbInsertRunningScrapeJob(ALICE_AUTH, LB_ALICE);
    if (!ins.ok) throw new Error("seed failed");

    const outcome = await dbCancelScrapeJob(ins.jobId, ALICE_AUTH);
    expect(outcome).toBe("cancelled");

    const row = await readRow(ins.jobId);
    expect(row?.status).toBe("cancelled");
    expect(row?.finishedAt).not.toBeNull();
  });

  it("refuses to cancel another user's job (returns not_found)", async () => {
    const ins = await dbInsertRunningScrapeJob(ALICE_AUTH, LB_ALICE);
    if (!ins.ok) throw new Error("seed failed");

    const outcome = await dbCancelScrapeJob(ins.jobId, BOB_AUTH);
    expect(outcome).toBe("not_found");

    const row = await readRow(ins.jobId);
    expect(row?.status).toBe("running");
  });

  it("returns not_running for a job that already completed", async () => {
    const ins = await dbInsertRunningScrapeJob(ALICE_AUTH, LB_ALICE);
    if (!ins.ok) throw new Error("seed failed");
    await db
      .update(userScrapeJobs)
      .set({ status: "completed", finishedAt: new Date() })
      .where(eq(userScrapeJobs.id, ins.jobId));

    const outcome = await dbCancelScrapeJob(ins.jobId, ALICE_AUTH);
    expect(outcome).toBe("not_running");

    const row = await readRow(ins.jobId);
    expect(row?.status).toBe("completed");
  });

  it("returns not_found for a non-existent id", async () => {
    const outcome = await dbCancelScrapeJob(
      "00000000-0000-0000-0000-000000000000",
      ALICE_AUTH,
    );
    expect(outcome).toBe("not_found");
  });
});

// ===========================
// dbMarkScrapeJobFailed — atomic rollback after worker handoff failure
// ===========================

describe("dbMarkScrapeJobFailed", () => {
  it("flips status to failed and appends an error entry", async () => {
    const ins = await dbInsertRunningScrapeJob(ALICE_AUTH, LB_ALICE);
    if (!ins.ok) throw new Error("seed failed");

    await dbMarkScrapeJobFailed(ins.jobId, "worker unreachable");

    const row = await readRow(ins.jobId);
    expect(row?.status).toBe("failed");
    expect(row?.finishedAt).not.toBeNull();
    const errors = row?.errors as Array<{ error: string; phase: string }> | null;
    expect(errors?.length).toBe(1);
    expect(errors?.[0]?.phase).toBe("trigger");
    expect(errors?.[0]?.error).toBe("worker unreachable");
  });

  it("only touches running rows (won't clobber a worker that raced ahead)", async () => {
    const ins = await dbInsertRunningScrapeJob(ALICE_AUTH, LB_ALICE);
    if (!ins.ok) throw new Error("seed failed");
    // Pretend the worker has already started writing 'completed'.
    await db
      .update(userScrapeJobs)
      .set({ status: "completed", finishedAt: new Date() })
      .where(eq(userScrapeJobs.id, ins.jobId));

    // The rollback runs but its WHERE clause matches nothing — no clobber.
    await dbMarkScrapeJobFailed(ins.jobId, "worker timeout");

    const row = await readRow(ins.jobId);
    expect(row?.status).toBe("completed");
  });
});
