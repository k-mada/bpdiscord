/**
 * Regression tests for the taste_compatibility(a, b) SQL function against
 * hand-computed expected values.
 *
 * Seeds its own uniquely-prefixed users and cleans up only those rows — no
 * cleanDatabase/resetDatabase — so it doesn't fight the shared local DB
 * (see bpdiscord-141).
 *
 * Run with: yarn test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { inArray } from 'drizzle-orm';
import { dbGetTasteCompatibility } from '../controllers/dataController';
import { assertTestEnvironment } from './setup';
import { db } from '../db';
import { users, userFilms } from '../db/schema';

const USERNAMES = ['tc_a', 'tc_b', 'tc_c'];

/*
 * tc_a vs tc_b over the four both-rated films:
 *   a = [5, 4, 3, 2]   b = [4, 5, 2, 3]   (means 3.5 / 3.5)
 *   Σxy=52 Σx=Σy=14 Σx²=Σy²=54  → corr = 12/20 = 0.6 exactly
 *   MAD = (1+1+1+1)/4 = 1.0
 * tc_a vs tc_c: tc_c gives 3.0 to all → zero variance → pearson NULL, MAD 1.0.
 * tc-f5/tc-f6 carry an unrated (NULL) and a zero rating to prove the > 0
 * filter leaves sampleSize at 4.
 */
const AB_PEARSON = 0.6;
const AB_MAD = 1.0;
const SAMPLE_SIZE = 4;

beforeAll(async () => {
  assertTestEnvironment();
  await db
    .insert(users)
    .values(USERNAMES.map((lbusername) => ({ lbusername, isDiscord: true })))
    .onConflictDoNothing();

  const rows: Array<{
    filmSlug: string;
    lbusername: string;
    rating: number | null;
  }> = [
    { filmSlug: 'tc-f1', lbusername: 'tc_a', rating: 5.0 },
    { filmSlug: 'tc-f2', lbusername: 'tc_a', rating: 4.0 },
    { filmSlug: 'tc-f3', lbusername: 'tc_a', rating: 3.0 },
    { filmSlug: 'tc-f4', lbusername: 'tc_a', rating: 2.0 },
    { filmSlug: 'tc-f5', lbusername: 'tc_a', rating: null },
    { filmSlug: 'tc-f6', lbusername: 'tc_a', rating: 4.0 },

    { filmSlug: 'tc-f1', lbusername: 'tc_b', rating: 4.0 },
    { filmSlug: 'tc-f2', lbusername: 'tc_b', rating: 5.0 },
    { filmSlug: 'tc-f3', lbusername: 'tc_b', rating: 2.0 },
    { filmSlug: 'tc-f4', lbusername: 'tc_b', rating: 3.0 },
    { filmSlug: 'tc-f5', lbusername: 'tc_b', rating: 4.0 },
    { filmSlug: 'tc-f6', lbusername: 'tc_b', rating: 0.0 },

    { filmSlug: 'tc-f1', lbusername: 'tc_c', rating: 3.0 },
    { filmSlug: 'tc-f2', lbusername: 'tc_c', rating: 3.0 },
    { filmSlug: 'tc-f3', lbusername: 'tc_c', rating: 3.0 },
    { filmSlug: 'tc-f4', lbusername: 'tc_c', rating: 3.0 },
  ];
  await db.insert(userFilms).values(rows).onConflictDoNothing();
});

afterAll(async () => {
  await db.delete(userFilms).where(inArray(userFilms.lbusername, USERNAMES));
  await db.delete(users).where(inArray(users.lbusername, USERNAMES));
});

describe('taste_compatibility(a, b)', () => {
  it('matches known hand-computed pearson/mad/sampleSize', async () => {
    const result = await dbGetTasteCompatibility('tc_a', 'tc_b');
    expect(result.success).toBe(true);
    expect(result.data!.pearson).toBeCloseTo(AB_PEARSON, 10);
    expect(result.data!.mad).toBeCloseTo(AB_MAD, 10);
    expect(result.data!.sampleSize).toBe(SAMPLE_SIZE);
  });

  it('returns null pearson on zero variance, non-null mad', async () => {
    const result = await dbGetTasteCompatibility('tc_a', 'tc_c');
    expect(result.success).toBe(true);
    expect(result.data!.pearson).toBeNull();
    expect(result.data!.mad).toBeCloseTo(AB_MAD, 10);
    expect(result.data!.sampleSize).toBe(SAMPLE_SIZE);
  });

  it('excludes unrated (null) and zero ratings from the sample', async () => {
    // tc-f5 (tc_a null) and tc-f6 (tc_b zero) must not count → sampleSize 4.
    const result = await dbGetTasteCompatibility('tc_a', 'tc_b');
    expect(result.data!.sampleSize).toBe(SAMPLE_SIZE);
  });
});
