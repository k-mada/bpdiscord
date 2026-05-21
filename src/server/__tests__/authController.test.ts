/**
 * Focused unit-ish tests for AuthController.signup — the pieces that don't
 * require a real Supabase Auth round-trip.
 *
 * Covered here:
 *   - lbusername format rejection (400)
 *   - lbusername normalization (lowercase + trim)
 *   - fast-path uniqueness check (409 before any auth call)
 *
 * NOT covered here (deferred to Stage 5 cross-cutting tests, bpdiscord-0ni):
 *   - happy-path signup that creates auth + Users stub + app_users + scrape job
 *   - the unique-violation race in the transaction + compensating delete
 *   - auto-sign-in behavior
 *
 * Those need either a full local-Supabase stack run or a substantial mock
 * harness for the supabase-js client; they're out of scope for Stage 1.
 */

import { sql } from 'drizzle-orm';
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Request, Response } from 'express';

import { AuthController, humanizeSupabaseAuthError } from '../controllers/authController';
import { LBUSERNAME_FORMAT } from '../lib/lbusername';
import { db } from '../db';
import { appUsers, users } from '../db/schema';
import { assertTestEnvironment, resetDatabase, closeDatabase } from './setup';

beforeAll(async () => {
  assertTestEnvironment();
  await resetDatabase();
});

afterAll(async () => {
  // Drop any auth.users rows we seeded so subsequent runs start clean.
  await db.execute(sql`
    DELETE FROM auth.users WHERE email LIKE 'authcontroller-test-%@example.test'
  `);
  await closeDatabase();
});

beforeEach(async () => {
  // Per-test reset so claimed-lbusername state doesn't leak between cases.
  // Also nukes the seeded auth.users rows; recreate as needed.
  await db.delete(appUsers).where(sql`1=1`);
  await db.execute(sql`
    DELETE FROM auth.users WHERE email LIKE 'authcontroller-test-%@example.test'
  `);
});

interface MockedResponse {
  req: Request;
  res: Response;
  statusCalls: number[];
  jsonCalls: unknown[];
}

function mockReqRes(body: Record<string, unknown>): MockedResponse {
  const statusCalls: number[] = [];
  const jsonCalls: unknown[] = [];
  const res = {} as { status: (c: number) => unknown; json: (p: unknown) => unknown };
  res.status = (code: number) => {
    statusCalls.push(code);
    return res;
  };
  res.json = (payload: unknown) => {
    jsonCalls.push(payload);
    return res;
  };
  return {
    req: { body } as Request,
    res: res as unknown as Response,
    statusCalls,
    jsonCalls,
  };
}

// Insert auth.users row + Users row + app_users row to simulate "this
// Letterboxd.com username is already claimed." The Users row is needed because
// app_users.lbusername has a FK to "Users"(lbusername).
async function seedClaimedLbusername(lbusername: string): Promise<void> {
  const userId = crypto.randomUUID();
  await db.execute(sql`
    INSERT INTO auth.users (id, email)
    VALUES (${userId}::uuid, ${'authcontroller-test-claimer@example.test'})
  `);
  await db.insert(users).values({ lbusername, isDiscord: true }).onConflictDoNothing();
  await db.insert(appUsers).values({ id: userId, lbusername });
}

describe('AuthController.signup — format validation (returns before auth)', () => {
  it('rejects an lbusername with characters outside [a-z0-9_-]', async () => {
    const { req, res, statusCalls, jsonCalls } = mockReqRes({
      email: 'authcontroller-test-fmt1@example.test',
      password: 'irrelevant',
      name: 'Test',
      lbusername: 'invalid name with spaces',
    });

    await AuthController.signup(req, res);

    expect(statusCalls).toEqual([400]);
    expect(jsonCalls[0]).toMatchObject({
      error: expect.stringContaining('2–15 characters'),
    });
  });

  it('rejects an lbusername shorter than 2 chars', async () => {
    const { req, res, statusCalls } = mockReqRes({
      email: 'authcontroller-test-fmt2@example.test',
      password: 'irrelevant',
      name: 'Test',
      lbusername: 'a',
    });

    await AuthController.signup(req, res);

    expect(statusCalls).toEqual([400]);
  });

  it('rejects an lbusername longer than 15 chars', async () => {
    const { req, res, statusCalls } = mockReqRes({
      email: 'authcontroller-test-fmt3@example.test',
      password: 'irrelevant',
      name: 'Test',
      lbusername: 'a'.repeat(16),
    });

    await AuthController.signup(req, res);

    expect(statusCalls).toEqual([400]);
  });

});

describe('LBUSERNAME_FORMAT regex', () => {
  // Direct regex tests — independent of the controller flow, so we don't rely
  // on indirect signals (like "the response wasn't a format-validation error").
  const valid = [
    'ab',
    'abcdefghijklmno', // 15 chars (upper bound)
    'a-b',
    'a_b',
    'user-1',
    'user_1',
    'a1b2c3',
    '0123456789',
    'a---b',
    'a___b',
  ];
  const invalid = [
    '',
    'a', // too short
    'abcdefghijklmnop', // 16 chars (over upper bound)
    'a b', // space
    'a.b', // period
    'a@b', // at-sign
    'a/b', // slash
    'A-valid', // uppercase before normalization (regex assumes lowercase)
    'café', // non-ASCII
    'a\nb', // newline
  ];

  it.each(valid)('accepts %j', (input) => {
    expect(LBUSERNAME_FORMAT.test(input)).toBe(true);
  });

  it.each(invalid)('rejects %j', (input) => {
    expect(LBUSERNAME_FORMAT.test(input)).toBe(false);
  });
});

describe('humanizeSupabaseAuthError', () => {
  it('rewrites the verbose "password should contain at least one character" message', () => {
    const supabaseMsg =
      'Password should contain at least one character of each: abcdefghijklmnopqrstuvwxyz, ABCDEFGHIJKLMNOPQRSTUVWXYZ, 0123456789.';
    expect(humanizeSupabaseAuthError(supabaseMsg)).toBe(
      'Password must include a lowercase letter, an uppercase letter, and a number.',
    );
  });

  it('rewrites min-length messages while preserving the length Supabase reports', () => {
    expect(humanizeSupabaseAuthError('Password should be at least 6 characters.')).toBe(
      'Password must be at least 6 characters.',
    );
  });

  it('rewrites min-length messages with a generic fallback when no length is parseable', () => {
    expect(humanizeSupabaseAuthError('Password should be at least short.')).toBe(
      'Password is too short.',
    );
  });

  it('rewrites duplicate-email errors', () => {
    expect(humanizeSupabaseAuthError('User already registered')).toBe(
      'An account with this email already exists.',
    );
  });

  it('rewrites the rate-limit "for security purposes" message, preserving seconds', () => {
    const supabaseMsg = 'For security purposes, you can only request this after 50 seconds.';
    expect(humanizeSupabaseAuthError(supabaseMsg)).toBe(
      'Too many signup attempts. Please wait 50 seconds and try again.',
    );
  });

  it('rewrites the rate-limit message with a generic fallback when seconds are not parseable', () => {
    const supabaseMsg = 'For security purposes, you can only request this after a while.';
    expect(humanizeSupabaseAuthError(supabaseMsg)).toBe(
      'Too many signup attempts. Please wait a moment and try again.',
    );
  });

  it('rewrites the email rate limit message', () => {
    expect(humanizeSupabaseAuthError('email rate limit exceeded')).toBe(
      'Our email service is rate-limited right now. Please try again in a few minutes, or contact an admin if this persists.',
    );
  });

  it('falls through to the original message for unmapped errors', () => {
    expect(humanizeSupabaseAuthError('Some new Supabase error')).toBe('Some new Supabase error');
  });

  it('returns a generic message when input is undefined', () => {
    expect(humanizeSupabaseAuthError(undefined)).toBe('Signup failed');
  });
});

describe('AuthController.signup — fast-path uniqueness check', () => {
  it('returns 409 when an lbusername is already claimed', async () => {
    await seedClaimedLbusername('claimed_name');

    const { req, res, statusCalls, jsonCalls } = mockReqRes({
      email: 'authcontroller-test-dup@example.test',
      password: 'irrelevant',
      name: 'Test',
      lbusername: 'claimed_name',
    });

    await AuthController.signup(req, res);

    expect(statusCalls).toEqual([409]);
    expect(jsonCalls[0]).toMatchObject({
      error: expect.stringContaining('already been claimed'),
    });
  });

  it('normalizes lbusername (uppercase/whitespace) before the uniqueness lookup', async () => {
    await seedClaimedLbusername('claimed_name');

    const { req, res, statusCalls } = mockReqRes({
      email: 'authcontroller-test-norm@example.test',
      password: 'irrelevant',
      name: 'Test',
      lbusername: '  Claimed_Name  ',
    });

    await AuthController.signup(req, res);

    // Normalization (trim + lowercase) means this should match the seeded
    // 'claimed_name' row and be rejected as already claimed.
    expect(statusCalls).toEqual([409]);
  });
});
