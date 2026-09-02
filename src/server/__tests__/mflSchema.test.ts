/**
 * Integration tests for the MFL schema constraints added in bpdiscord-b6l.
 *
 * These guard decisions that are invisible in the Drizzle declarations and
 * exist only in the migration: the two ON DELETE behaviours differ on purpose,
 * and the unique constraint is what bpdiscord-6c7 maps to a 409.
 *
 * Run with: NODE_ENV=test yarn test
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";

import { db } from "../db";
import {
  mflFilms,
  mflScoringMetrics,
  mflScoringTally,
  mflUserPicks,
  users,
} from "../db/schema";

import { assertTestEnvironment, cleanDatabase, closeDatabase } from "./setup";

const LB_ALICE = "alice_lb";
const SLUG = "one-battle-after-another";
const OTHER_SLUG = "sentimental-value-2025";
const METRIC_GOTHAM = 27;
const METRIC_ZERO = 99;

// Drizzle wraps the driver error, so the constraint name lives on `cause`, not
// on the message. Returning it keeps every expect() inside an it() block.
async function violatedConstraint(query: Promise<unknown>): Promise<string> {
  try {
    await query;
  } catch (error) {
    const cause = (error as { cause?: { constraint_name?: string } }).cause;
    return cause?.constraint_name ?? "no constraint_name on error cause";
  }
  return "query unexpectedly succeeded";
}

beforeAll(() => {
  assertTestEnvironment();
});

beforeEach(async () => {
  await cleanDatabase();
  await db.insert(users).values([{ lbusername: LB_ALICE, isDiscord: true }]);
  await db.insert(mflFilms).values([
    { filmSlug: SLUG, title: "One Battle After Another", price: 40 },
    { filmSlug: OTHER_SLUG, title: "Sentimental Value", price: 25 },
  ]);
  // fk_metric_id means a tally row cannot name a metric that does not exist.
  await db.insert(mflScoringMetrics).values([
    { metricId: METRIC_GOTHAM, metricName: "Gotham Awards", pointValue: 15 },
    { metricId: METRIC_ZERO, metricName: "Nominated, did not win", pointValue: 0 },
  ]);
});

afterAll(async () => {
  await closeDatabase();
});

describe("MFLScoringTally uniqueness", () => {
  it("rejects a second award of the same metric to the same film", async () => {
    await db
      .insert(mflScoringTally)
      .values({ filmSlug: SLUG, metricId: METRIC_GOTHAM, pointsAwarded: 15 });

    const constraint = await violatedConstraint(
      db
        .insert(mflScoringTally)
        .values({ filmSlug: SLUG, metricId: METRIC_GOTHAM, pointsAwarded: 15 }),
    );

    expect(constraint).toBe("mfl_scoring_tally_film_metric_key");
  });

  it("allows the same metric on a different film", async () => {
    await db.insert(mflScoringTally).values([
      { filmSlug: SLUG, metricId: METRIC_GOTHAM, pointsAwarded: 15 },
      { filmSlug: OTHER_SLUG, metricId: METRIC_GOTHAM, pointsAwarded: 15 },
    ]);

    const rows = await db
      .select()
      .from(mflScoringTally)
      .where(eq(mflScoringTally.metricId, METRIC_GOTHAM));

    expect(rows).toHaveLength(2);
  });

  it("allows an award worth zero points", async () => {
    await db
      .insert(mflScoringTally)
      .values({ filmSlug: SLUG, metricId: METRIC_ZERO, pointsAwarded: 0 });

    const [row] = await db
      .select()
      .from(mflScoringTally)
      .where(eq(mflScoringTally.metricId, METRIC_ZERO));

    expect(row.pointsAwarded).toBe(0);
  });
});

describe("MFLUserPicks referential behaviour", () => {
  it("cascades picks when the user is deleted", async () => {
    await db
      .insert(mflUserPicks)
      .values({ lbusername: LB_ALICE, filmSlug: SLUG });

    await db.delete(users).where(eq(users.lbusername, LB_ALICE));

    expect(await db.select().from(mflUserPicks)).toHaveLength(0);
  });

  it("refuses to delete a film somebody has picked", async () => {
    await db
      .insert(mflUserPicks)
      .values({ lbusername: LB_ALICE, filmSlug: SLUG });

    const constraint = await violatedConstraint(
      db.delete(mflFilms).where(eq(mflFilms.filmSlug, SLUG)),
    );

    expect(constraint).toBe("mfl_user_picks_film_slug_fkey");
    expect(await db.select().from(mflFilms)).toHaveLength(2);
  });

  it("allows deleting a film nobody picked", async () => {
    await db
      .insert(mflUserPicks)
      .values({ lbusername: LB_ALICE, filmSlug: SLUG });

    await db.delete(mflFilms).where(eq(mflFilms.filmSlug, OTHER_SLUG));

    const rows = await db.select().from(mflFilms);
    expect(rows.map((r) => r.filmSlug)).toEqual([SLUG]);
  });

  it("rejects a pick naming a film that is not in the season", async () => {
    const constraint = await violatedConstraint(
      db
        .insert(mflUserPicks)
        .values({ lbusername: LB_ALICE, filmSlug: "not-in-the-season" }),
    );

    expect(constraint).toBe("mfl_user_picks_film_slug_fkey");
  });

  it("rejects a pick naming an unknown user", async () => {
    const constraint = await violatedConstraint(
      db.insert(mflUserPicks).values({ lbusername: "nobody", filmSlug: SLUG }),
    );

    expect(constraint).toBe("mfl_user_picks_lbusername_fkey");
  });

  it("rejects the same user picking the same film twice", async () => {
    await db
      .insert(mflUserPicks)
      .values({ lbusername: LB_ALICE, filmSlug: SLUG });

    const constraint = await violatedConstraint(
      db.insert(mflUserPicks).values({ lbusername: LB_ALICE, filmSlug: SLUG }),
    );

    expect(constraint).toBe("mfl_user_picks_pkey");
  });
});
