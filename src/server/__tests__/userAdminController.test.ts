/**
 * Integration tests for UserAdminController. The Supabase admin SDK is mocked
 * (createSupabaseAdminClient → fake auth.admin) so we can deterministically
 * configure listUsers / getUserById / updateUserById / deleteUser responses
 * per test. The Drizzle DB layer (app_users, "Users", user_scrape_jobs) hits
 * the real test database.
 *
 * Race-condition tests (two concurrent claims of the same lbusername) are
 * deferred to Stage 5 (bpdiscord-0ni) per scope.
 */

import { sql, eq } from 'drizzle-orm';
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Request, Response, NextFunction } from 'express';

// Hoisted mock so the controller picks it up at import time.
vi.mock('../config/database', async () => {
  const actual = await vi.importActual<typeof import('../config/database')>(
    '../config/database',
  );
  return {
    ...actual,
    createSupabaseAdminClient: vi.fn(),
  };
});

import { UserAdminController } from '../controllers/userAdminController';
import { createSupabaseAdminClient } from '../config/database';
import { authorizeAdmin } from '../middleware/auth';
import { db } from '../db';
import { appUsers, users, userScrapeJobs } from '../db/schema';
import { assertTestEnvironment, resetDatabase, closeDatabase } from './setup';

// Stable IDs so tests can reference the same fixture across assertions.
const ADMIN_ID = '00000000-0000-0000-0000-000000000001';
const TARGET_ID = '00000000-0000-0000-0000-000000000002';
const OTHER_ID = '00000000-0000-0000-0000-000000000003';

// Helper: build the four-method stub for createSupabaseAdminClient. Each test
// configures returns via the methods on the returned object.
type SdkMock = {
  auth: {
    admin: {
      listUsers: ReturnType<typeof vi.fn>;
      getUserById: ReturnType<typeof vi.fn>;
      updateUserById: ReturnType<typeof vi.fn>;
      deleteUser: ReturnType<typeof vi.fn>;
    };
  };
};

function installSdkMock(): SdkMock {
  const mock: SdkMock = {
    auth: {
      admin: {
        listUsers: vi.fn(),
        getUserById: vi.fn(),
        updateUserById: vi.fn(),
        deleteUser: vi.fn(),
      },
    },
  };
  vi.mocked(createSupabaseAdminClient).mockReturnValue(mock as never);
  return mock;
}

interface MockedResponse {
  req: Request;
  res: Response;
  statusCalls: number[];
  jsonCalls: unknown[];
}

function mockReqRes(args: {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  user?: { id: string; user_metadata?: Record<string, unknown> };
}): MockedResponse {
  const statusCalls: number[] = [];
  const jsonCalls: unknown[] = [];
  const res = {} as {
    status: (c: number) => unknown;
    json: (p: unknown) => unknown;
  };
  res.status = (code: number) => {
    statusCalls.push(code);
    return res;
  };
  res.json = (payload: unknown) => {
    jsonCalls.push(payload);
    return res;
  };
  const req = {
    body: args.body ?? {},
    params: args.params ?? {},
    user: args.user,
  } as unknown as Request;
  return { req, res: res as unknown as Response, statusCalls, jsonCalls };
}

function adminReq(extras: Parameters<typeof mockReqRes>[0]): MockedResponse {
  return mockReqRes({
    ...extras,
    user: {
      id: ADMIN_ID,
      user_metadata: { role: 'admin' },
      ...extras.user,
    } as { id: string; user_metadata: Record<string, unknown> },
  });
}

async function seedAuthUser(id: string, email: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO auth.users (id, email)
    VALUES (${id}::uuid, ${email})
    ON CONFLICT (id) DO NOTHING
  `);
}

async function seedAppUser(id: string, lbusername: string | null = null): Promise<void> {
  if (lbusername !== null) {
    await db.insert(users).values({ lbusername, isDiscord: true }).onConflictDoNothing();
  }
  await db.insert(appUsers).values({ id, lbusername });
}

beforeAll(async () => {
  assertTestEnvironment();
  await resetDatabase();
});

afterAll(async () => {
  await db.execute(sql`
    DELETE FROM auth.users WHERE email LIKE 'useradmin-test-%@example.test'
  `);
  await closeDatabase();
});

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete(userScrapeJobs).where(sql`1=1`);
  await db.delete(appUsers).where(sql`1=1`);
  await db.execute(sql`
    DELETE FROM auth.users WHERE email LIKE 'useradmin-test-%@example.test'
  `);
});

// ─────────────────────────────────────────────────────────────────────────────
//  GET /api/admin/users — list
// ─────────────────────────────────────────────────────────────────────────────
describe('UserAdminController.list', () => {
  it('merges Drizzle app_users + auth.admin.listUsers by id', async () => {
    await seedAuthUser(TARGET_ID, 'useradmin-test-1@example.test');
    await seedAppUser(TARGET_ID, 'lb_target_user');

    const sdk = installSdkMock();
    sdk.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: TARGET_ID,
            email: 'useradmin-test-1@example.test',
            user_metadata: { name: 'Target User', role: 'user' },
          },
        ],
      },
      error: null,
    });

    const { req, res, statusCalls, jsonCalls } = adminReq({});
    await UserAdminController.list(req, res);

    expect(statusCalls).toEqual([200]);
    const payload = jsonCalls[0] as { data: unknown[] };
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]).toMatchObject({
      id: TARGET_ID,
      email: 'useradmin-test-1@example.test',
      name: 'Target User',
      lbusername: 'lb_target_user',
    });
  });

  it('synthesizes a row for auth users with no app_users record', async () => {
    // Auth user exists; no app_users row (e.g. created outside our signup flow).
    await seedAuthUser(TARGET_ID, 'useradmin-test-orphan@example.test');

    const sdk = installSdkMock();
    sdk.auth.admin.listUsers.mockResolvedValue({
      data: {
        users: [
          {
            id: TARGET_ID,
            email: 'useradmin-test-orphan@example.test',
            user_metadata: { name: 'Orphan', role: 'user' },
          },
        ],
      },
      error: null,
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { req, res, statusCalls, jsonCalls } = adminReq({});
    await UserAdminController.list(req, res);

    expect(statusCalls).toEqual([200]);
    const payload = jsonCalls[0] as { data: Array<{ id: string; lbusername: string | null }> };
    expect(payload.data).toHaveLength(1);
    expect(payload.data[0]?.lbusername).toBeNull();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('has no app_users row'),
    );
    warnSpy.mockRestore();
  });

  it('returns 502 when auth.admin.listUsers fails', async () => {
    const sdk = installSdkMock();
    sdk.auth.admin.listUsers.mockResolvedValue({
      data: { users: [] },
      error: { message: 'upstream down' },
    });

    const { req, res, statusCalls } = adminReq({});
    await UserAdminController.list(req, res);

    expect(statusCalls).toEqual([502]);
  });

  it('warns when listUsers hits the pagination cap', async () => {
    // Synthesize a cap-sized response.
    const usersAtCap = Array.from({ length: 1000 }, (_, i) => ({
      id: `00000000-0000-0000-0000-${String(i).padStart(12, '0')}`,
      email: `cap-${i}@example.test`,
      user_metadata: {},
    }));
    const sdk = installSdkMock();
    sdk.auth.admin.listUsers.mockResolvedValue({
      data: { users: usersAtCap },
      error: null,
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    const { req, res, statusCalls } = adminReq({});
    await UserAdminController.list(req, res);

    expect(statusCalls).toEqual([200]);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('possible truncation at cap'),
    );
    warnSpy.mockRestore();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  PUT /api/admin/users/:id — update
// ─────────────────────────────────────────────────────────────────────────────
describe('UserAdminController.update', () => {
  it('returns 404 when the account does not exist', async () => {
    const sdk = installSdkMock();
    sdk.auth.admin.getUserById.mockResolvedValue({
      data: { user: null },
      error: { message: 'not found' },
    });

    const { req, res, statusCalls } = adminReq({
      params: { id: TARGET_ID },
      body: { name: 'New Name' },
    });
    await UserAdminController.update(req, res);

    expect(statusCalls).toEqual([404]);
  });

  it('returns 400 when lbusername fails format validation', async () => {
    await seedAuthUser(TARGET_ID, 'useradmin-test-fmt@example.test');
    await seedAppUser(TARGET_ID);

    const sdk = installSdkMock();
    sdk.auth.admin.getUserById.mockResolvedValue({
      data: {
        user: {
          id: TARGET_ID,
          email: 'useradmin-test-fmt@example.test',
          user_metadata: { role: 'user' },
        },
      },
      error: null,
    });

    const { req, res, statusCalls } = adminReq({
      params: { id: TARGET_ID },
      body: { lbusername: 'has spaces' },
    });
    await UserAdminController.update(req, res);

    expect(statusCalls).toEqual([400]);
  });

  it('returns 409 when lbusername is held by another account', async () => {
    await seedAuthUser(OTHER_ID, 'useradmin-test-claimer@example.test');
    await seedAppUser(OTHER_ID, 'lb_taken');
    await seedAuthUser(TARGET_ID, 'useradmin-test-target@example.test');
    await seedAppUser(TARGET_ID);

    const sdk = installSdkMock();
    sdk.auth.admin.getUserById.mockResolvedValue({
      data: {
        user: {
          id: TARGET_ID,
          email: 'useradmin-test-target@example.test',
          user_metadata: { role: 'user' },
        },
      },
      error: null,
    });

    const { req, res, statusCalls, jsonCalls } = adminReq({
      params: { id: TARGET_ID },
      body: { lbusername: 'lb_taken' },
    });
    await UserAdminController.update(req, res);

    expect(statusCalls).toEqual([409]);
    expect(jsonCalls[0]).toMatchObject({
      error: expect.stringContaining('already been claimed'),
    });
    // We deliberately do NOT expose the claimer's identity in the response.
    // Admin can look it up via GET /api/admin/users if needed.
    expect(jsonCalls[0]).not.toHaveProperty('claimedBy');
    // Only the target's getUserById should have been called — not the
    // claimer's (we removed that lookup entirely).
    expect(sdk.auth.admin.getUserById).toHaveBeenCalledTimes(1);
    expect(sdk.auth.admin.getUserById).toHaveBeenCalledWith(TARGET_ID);
  });

  it('links a new lbusername, auto-creates Users stub, enqueues scrape', async () => {
    await seedAuthUser(TARGET_ID, 'useradmin-test-link@example.test');
    await seedAppUser(TARGET_ID);

    const sdk = installSdkMock();
    sdk.auth.admin.getUserById.mockResolvedValue({
      data: {
        user: {
          id: TARGET_ID,
          email: 'useradmin-test-link@example.test',
          user_metadata: { role: 'user' },
        },
      },
      error: null,
    });

    const { req, res, statusCalls } = adminReq({
      params: { id: TARGET_ID },
      body: { lbusername: 'lb_brand_new' },
    });
    await UserAdminController.update(req, res);

    expect(statusCalls).toEqual([200]);

    // Users stub created with is_discord=true.
    const usersRows = await db
      .select()
      .from(users)
      .where(eq(users.lbusername, 'lb_brand_new'));
    expect(usersRows[0]?.isDiscord).toBe(true);

    // app_users row updated.
    const appRow = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.id, TARGET_ID))
      .limit(1);
    expect(appRow[0]?.lbusername).toBe('lb_brand_new');

    // Scrape job enqueued by the admin.
    const jobs = await db
      .select()
      .from(userScrapeJobs)
      .where(eq(userScrapeJobs.lbusername, 'lb_brand_new'));
    expect(jobs).toHaveLength(1);
    expect(jobs[0]?.status).toBe('pending');
    expect(jobs[0]?.startedBy).toBe(ADMIN_ID);
  });

  it('does NOT enqueue scrape when linking to an existing Users row', async () => {
    await seedAuthUser(TARGET_ID, 'useradmin-test-existing@example.test');
    await seedAppUser(TARGET_ID);
    // Pre-existing Users row (e.g. previously scraped).
    await db.insert(users).values({ lbusername: 'lb_existing', isDiscord: true });

    const sdk = installSdkMock();
    sdk.auth.admin.getUserById.mockResolvedValue({
      data: {
        user: {
          id: TARGET_ID,
          email: 'useradmin-test-existing@example.test',
          user_metadata: { role: 'user' },
        },
      },
      error: null,
    });

    const { req, res, statusCalls } = adminReq({
      params: { id: TARGET_ID },
      body: { lbusername: 'lb_existing' },
    });
    await UserAdminController.update(req, res);

    expect(statusCalls).toEqual([200]);
    const jobs = await db
      .select()
      .from(userScrapeJobs)
      .where(eq(userScrapeJobs.lbusername, 'lb_existing'));
    expect(jobs).toHaveLength(0);
  });

  it('unlinks lbusername when payload is null', async () => {
    await seedAuthUser(TARGET_ID, 'useradmin-test-unlink@example.test');
    await seedAppUser(TARGET_ID, 'lb_to_unlink');

    const sdk = installSdkMock();
    sdk.auth.admin.getUserById.mockResolvedValue({
      data: {
        user: {
          id: TARGET_ID,
          email: 'useradmin-test-unlink@example.test',
          user_metadata: { role: 'user' },
        },
      },
      error: null,
    });

    const { req, res, statusCalls } = adminReq({
      params: { id: TARGET_ID },
      body: { lbusername: null },
    });
    await UserAdminController.update(req, res);

    expect(statusCalls).toEqual([200]);
    const appRow = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.id, TARGET_ID))
      .limit(1);
    expect(appRow[0]?.lbusername).toBeNull();
  });

  it.each([
    ['empty string', ''],
    ['whitespace only', '   '],
  ])('treats %s lbusername as unlink (same as null)', async (_label, value) => {
    await seedAuthUser(TARGET_ID, 'useradmin-test-empty@example.test');
    await seedAppUser(TARGET_ID, 'lb_to_unlink');

    const sdk = installSdkMock();
    sdk.auth.admin.getUserById.mockResolvedValue({
      data: {
        user: {
          id: TARGET_ID,
          email: 'useradmin-test-empty@example.test',
          user_metadata: { role: 'user' },
        },
      },
      error: null,
    });

    const { req, res, statusCalls } = adminReq({
      params: { id: TARGET_ID },
      body: { lbusername: value },
    });
    await UserAdminController.update(req, res);

    expect(statusCalls).toEqual([200]);
    const appRow = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.id, TARGET_ID))
      .limit(1);
    expect(appRow[0]?.lbusername).toBeNull();
  });

  it('updates name via updateUserById merging existing user_metadata (preserves role)', async () => {
    await seedAuthUser(TARGET_ID, 'useradmin-test-name@example.test');
    await seedAppUser(TARGET_ID);

    const sdk = installSdkMock();
    sdk.auth.admin.getUserById.mockResolvedValue({
      data: {
        user: {
          id: TARGET_ID,
          email: 'useradmin-test-name@example.test',
          user_metadata: { name: 'Old Name', role: 'admin', somethingElse: 'keep_me' },
        },
      },
      error: null,
    });
    sdk.auth.admin.updateUserById.mockResolvedValue({
      data: { user: { id: TARGET_ID } },
      error: null,
    });

    const { req, res, statusCalls } = adminReq({
      params: { id: TARGET_ID },
      body: { name: 'New Name' },
    });
    await UserAdminController.update(req, res);

    expect(statusCalls).toEqual([200]);
    expect(sdk.auth.admin.updateUserById).toHaveBeenCalledWith(TARGET_ID, {
      user_metadata: {
        name: 'New Name',
        role: 'admin',
        somethingElse: 'keep_me',
      },
    });
  });

  it('updates email with email_confirm:true (skips confirmation flow)', async () => {
    await seedAuthUser(TARGET_ID, 'useradmin-test-email@example.test');
    await seedAppUser(TARGET_ID);

    const sdk = installSdkMock();
    sdk.auth.admin.getUserById.mockResolvedValue({
      data: {
        user: {
          id: TARGET_ID,
          email: 'useradmin-test-email@example.test',
          user_metadata: { role: 'user' },
        },
      },
      error: null,
    });
    sdk.auth.admin.updateUserById.mockResolvedValue({
      data: { user: { id: TARGET_ID } },
      error: null,
    });

    const { req, res, statusCalls } = adminReq({
      params: { id: TARGET_ID },
      body: { email: 'useradmin-test-new@example.test' },
    });
    await UserAdminController.update(req, res);

    expect(statusCalls).toEqual([200]);
    expect(sdk.auth.admin.updateUserById).toHaveBeenCalledWith(TARGET_ID, {
      email: 'useradmin-test-new@example.test',
      email_confirm: true,
    });
  });

  it('flags requiresReauth when admin changes their own email', async () => {
    await seedAuthUser(ADMIN_ID, 'useradmin-test-self@example.test');
    await seedAppUser(ADMIN_ID);

    const sdk = installSdkMock();
    sdk.auth.admin.getUserById.mockResolvedValue({
      data: {
        user: {
          id: ADMIN_ID,
          email: 'useradmin-test-self@example.test',
          user_metadata: { role: 'admin' },
        },
      },
      error: null,
    });
    sdk.auth.admin.updateUserById.mockResolvedValue({
      data: { user: { id: ADMIN_ID } },
      error: null,
    });

    const { req, res, statusCalls, jsonCalls } = adminReq({
      params: { id: ADMIN_ID },
      body: { email: 'useradmin-test-new@example.test' },
    });
    await UserAdminController.update(req, res);

    expect(statusCalls).toEqual([200]);
    // Verify the SDK was actually called — without this the test passes even
    // if the email-update code path is broken (requiresReauth is computed
    // from req.user.id === id alone).
    expect(sdk.auth.admin.updateUserById).toHaveBeenCalledWith(
      ADMIN_ID,
      expect.objectContaining({
        email: 'useradmin-test-new@example.test',
        email_confirm: true,
      }),
    );
    expect(jsonCalls[0]).toMatchObject({
      data: {
        requiresReauth: true,
        email: 'useradmin-test-new@example.test',
      },
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  DELETE /api/admin/users/:id — remove
// ─────────────────────────────────────────────────────────────────────────────
describe('UserAdminController.remove', () => {
  it('blocks self-deletion with 400', async () => {
    installSdkMock();
    const { req, res, statusCalls } = adminReq({
      params: { id: ADMIN_ID },
    });
    await UserAdminController.remove(req, res);

    expect(statusCalls).toEqual([400]);
  });

  it('returns 404 when deleteUser reports not found', async () => {
    const sdk = installSdkMock();
    sdk.auth.admin.deleteUser.mockResolvedValue({
      data: { user: null },
      error: { code: 'user_not_found', message: 'User not found' },
    });

    const { req, res, statusCalls } = adminReq({
      params: { id: TARGET_ID },
    });
    await UserAdminController.remove(req, res);

    expect(statusCalls).toEqual([404]);
  });

  it('deletes the auth user; FK cascades app_users row', async () => {
    await seedAuthUser(TARGET_ID, 'useradmin-test-del@example.test');
    await seedAppUser(TARGET_ID, 'lb_to_delete');

    const sdk = installSdkMock();
    sdk.auth.admin.deleteUser.mockImplementation(async (id: string) => {
      // Mirror the real Supabase behavior: delete the auth.users row. The FK
      // CASCADE will remove the app_users row automatically.
      await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
      return { data: { user: null }, error: null };
    });

    const { req, res, statusCalls, jsonCalls } = adminReq({
      params: { id: TARGET_ID },
    });
    await UserAdminController.remove(req, res);

    expect(statusCalls).toEqual([200]);
    expect(jsonCalls[0]).toMatchObject({
      data: { id: TARGET_ID, deleted: true },
    });

    // app_users row should be gone via cascade.
    const remaining = await db
      .select()
      .from(appUsers)
      .where(eq(appUsers.id, TARGET_ID));
    expect(remaining).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
//  Admin gating
// ─────────────────────────────────────────────────────────────────────────────
describe('admin gating (authorizeAdmin middleware)', () => {
  it('returns 403 for a non-admin user', () => {
    const statusCalls: number[] = [];
    const jsonCalls: unknown[] = [];
    const res = {} as { status: (c: number) => unknown; json: (p: unknown) => unknown };
    res.status = (c) => {
      statusCalls.push(c);
      return res;
    };
    res.json = (p) => {
      jsonCalls.push(p);
      return res;
    };
    const req = {
      user: { id: TARGET_ID, user_metadata: { role: 'user' } },
    } as unknown as Request;
    const next: NextFunction = vi.fn();

    authorizeAdmin(req, res as unknown as Response, next);

    expect(statusCalls).toEqual([403]);
    expect(next).not.toHaveBeenCalled();
  });

  it('calls next() for an admin user', () => {
    const res = {} as { status: (c: number) => unknown; json: (p: unknown) => unknown };
    res.status = vi.fn().mockReturnValue(res);
    res.json = vi.fn().mockReturnValue(res);
    const req = {
      user: { id: ADMIN_ID, user_metadata: { role: 'admin' } },
    } as unknown as Request;
    const next: NextFunction = vi.fn();

    authorizeAdmin(req, res as unknown as Response, next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
