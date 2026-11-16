/**
 * Integration tests for the admin profile endpoints (unclaimed Letterboxd
 * profiles, Discord or not). DB writes hit the test database; the Supabase
 * admin SDK and the worker handoff are mocked — the test env loads the real
 * WORKER_URL, so an unmocked handoff would reach the deployed worker.
 */

import { eq, sql } from 'drizzle-orm';
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { mockReqRes } from "./helpers/mockReqRes";

vi.mock('../config/database', async () => {
  const actual = await vi.importActual<typeof import('../config/database')>(
    '../config/database',
  );
  return { ...actual, createSupabaseAdminClient: vi.fn() };
});

vi.mock('../controllers/jobHelpers', async () => {
  const actual = await vi.importActual<typeof import('../controllers/jobHelpers')>(
    '../controllers/jobHelpers',
  );
  return { ...actual, getWorkerConfig: vi.fn(), callWorker: vi.fn() };
});

import { UserAdminController } from '../controllers/userAdminController';
import { createSupabaseAdminClient } from '../config/database';
import { callWorker, getWorkerConfig } from '../controllers/jobHelpers';
import { db } from '../db';
import { appUsers, mflRosters, userFilms, users, userScrapeJobs } from '../db/schema';
import {
  assertTestEnvironment,
  cleanDatabase,
  closeDatabase,
  resetDatabase,
  seedAuthUser,
} from './setup';

const ADMIN_ID = '00000000-0000-0000-0000-0000000000a1';
const ACCOUNT_ID = '00000000-0000-0000-0000-0000000000a2';
const WORKER = { url: 'http://worker.test', sharedSecret: 'secret' };

function adminReq(extras: Parameters<typeof mockReqRes>[0]) {
  return mockReqRes({
    ...extras,
    user: { id: ADMIN_ID, user_metadata: {} } as { id: string; user_metadata: Record<string, unknown> },
  });
}

async function usersRow(lbusername: string) {
  const rows = await db.select().from(users).where(eq(users.lbusername, lbusername));
  return rows[0];
}

beforeAll(async () => {
  assertTestEnvironment();
});

beforeEach(async () => {
  vi.clearAllMocks();
  vi.mocked(getWorkerConfig).mockReturnValue(WORKER);
  vi.mocked(callWorker).mockResolvedValue(undefined);
  await cleanDatabase();
  await db.execute(sql`DELETE FROM auth.users WHERE email LIKE 'profiles-test-%@example.test'`);
});

afterAll(async () => {
  await db.execute(sql`DELETE FROM auth.users WHERE email LIKE 'profiles-test-%@example.test'`);
  await resetDatabase();
  await closeDatabase();
});

describe('UserAdminController.list — profile rows', () => {
  it('returns unclaimed profiles beside accounts, flagged by kind and isDiscord', async () => {
    await seedAuthUser(ACCOUNT_ID, 'profiles-test-1@example.test');
    await db.insert(users).values([
      { lbusername: 'claimed', isDiscord: true },
      { lbusername: 'guest', displayName: 'Guest', isDiscord: false },
      { lbusername: 'lurker', isDiscord: true },
    ]);
    await db.insert(appUsers).values({ id: ACCOUNT_ID, lbusername: 'claimed' });
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      auth: {
        admin: {
          listUsers: vi.fn().mockResolvedValue({
            data: { users: [{ id: ACCOUNT_ID, email: 'profiles-test-1@example.test' }] },
            error: null,
          }),
        },
      },
    } as never);

    const { req, res, statusCalls, jsonCalls } = adminReq({});
    await UserAdminController.list(req, res);

    expect(statusCalls).toEqual([200]);
    const rows = (jsonCalls[0] as { data: Array<Record<string, unknown>> }).data;
    expect(rows).toHaveLength(3);
    expect(rows.find((r) => r.kind === 'account')).toMatchObject({
      id: ACCOUNT_ID,
      lbusername: 'claimed',
    });
    const profiles = rows.filter((r) => r.kind === 'profile');
    expect(profiles).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ lbusername: 'guest', name: 'Guest', isDiscord: false }),
        expect.objectContaining({ lbusername: 'lurker', isDiscord: true }),
      ]),
    );
  });
});

describe('UserAdminController.createProfile', () => {
  it('creates a non-Discord profile and hands a scrape job to the worker', async () => {
    const { req, res, statusCalls, jsonCalls } = adminReq({
      body: { name: '  Guest Critic ', lbusername: ' GuestCritic ' },
    });
    await UserAdminController.createProfile(req, res);

    expect(statusCalls).toEqual([201]);
    const row = await usersRow('guestcritic');
    expect(row).toMatchObject({ displayName: 'Guest Critic', isDiscord: false });

    const jobs = await db.select().from(userScrapeJobs);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ lbusername: 'guestcritic', status: 'running', startedBy: ADMIN_ID });
    expect(callWorker).toHaveBeenCalledWith(WORKER, '/scrape-user', {
      job_id: jobs[0]!.id,
      lbusername: 'guestcritic',
    });
    expect(jsonCalls[0]).toMatchObject({
      data: {
        profile: { kind: 'profile', lbusername: 'guestcritic', isDiscord: false },
        scrape: { started: true, jobId: jobs[0]!.id },
      },
    });
  });

  it('refuses an existing Discord row with 409 and leaves its flag alone', async () => {
    await db.insert(users).values({ lbusername: 'member', isDiscord: true });

    const { req, res, statusCalls } = adminReq({
      body: { name: 'Imposter', lbusername: 'member' },
    });
    await UserAdminController.createProfile(req, res);

    expect(statusCalls).toEqual([409]);
    expect(await usersRow('member')).toMatchObject({ isDiscord: true, displayName: null });
    expect(callWorker).not.toHaveBeenCalled();
  });

  it.each([
    [{ lbusername: 'okname' }, 'missing name'],
    [{ name: '   ', lbusername: 'okname' }, 'blank name'],
    [{ name: 'x'.repeat(81), lbusername: 'okname' }, 'name over 80'],
    [{ name: 'Ok' }, 'missing lbusername'],
    [{ name: 'Ok', lbusername: 'has space' }, 'bad lbusername'],
  ])('returns 400 for %o (%s)', async (body) => {
    const { req, res, statusCalls } = adminReq({ body });
    await UserAdminController.createProfile(req, res);

    expect(statusCalls).toEqual([400]);
    expect(await db.select().from(users)).toHaveLength(0);
  });

  it('keeps the profile and reports the failure when the worker is unreachable', async () => {
    vi.mocked(callWorker).mockRejectedValue(new Error('ECONNREFUSED'));
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const { req, res, statusCalls, jsonCalls } = adminReq({
      body: { name: 'Guest', lbusername: 'guest' },
    });
    await UserAdminController.createProfile(req, res);

    expect(statusCalls).toEqual([201]);
    expect(await usersRow('guest')).toBeDefined();
    expect(jsonCalls[0]).toMatchObject({ data: { scrape: { started: false } } });
    const jobs = await db.select().from(userScrapeJobs);
    expect(jobs[0]?.status).toBe('failed');
    errSpy.mockRestore();
  });

  it('reports an unconfigured worker without inserting a job', async () => {
    vi.mocked(getWorkerConfig).mockReturnValue(null);

    const { req, res, statusCalls, jsonCalls } = adminReq({
      body: { name: 'Guest', lbusername: 'guest' },
    });
    await UserAdminController.createProfile(req, res);

    expect(statusCalls).toEqual([201]);
    expect(jsonCalls[0]).toMatchObject({
      data: { scrape: { started: false, error: 'Worker not configured' } },
    });
    expect(await db.select().from(userScrapeJobs)).toHaveLength(0);
  });
});

describe('UserAdminController.updateProfile', () => {
  beforeEach(async () => {
    await db.insert(users).values({ lbusername: 'guest', displayName: 'Guest', isDiscord: false });
    await db.insert(userFilms).values({ lbusername: 'guest', filmSlug: 'heat', rating: 4 });
  });

  it('renames the display name in place, keeping the data', async () => {
    const { req, res, statusCalls, jsonCalls } = adminReq({
      params: { lbusername: 'guest' },
      body: { name: 'New Name' },
    });
    await UserAdminController.updateProfile(req, res);

    expect(statusCalls).toEqual([200]);
    expect(await usersRow('guest')).toMatchObject({ displayName: 'New Name', isDiscord: false });
    expect(await db.select().from(userFilms)).toHaveLength(1);
    expect(callWorker).not.toHaveBeenCalled();
    expect(jsonCalls[0]).toEqual({
      data: { profile: expect.objectContaining({ lbusername: 'guest', name: 'New Name' }) },
    });
  });

  it('treats the same username in another case as no username change', async () => {
    const { req, res, statusCalls } = adminReq({
      params: { lbusername: 'GUEST' },
      body: { name: 'Renamed', lbusername: 'Guest' },
    });
    await UserAdminController.updateProfile(req, res);

    expect(statusCalls).toEqual([200]);
    expect(await usersRow('guest')).toMatchObject({ displayName: 'Renamed' });
    expect(await db.select().from(userFilms)).toHaveLength(1);
    expect(callWorker).not.toHaveBeenCalled();
  });

  it('changes the username by dropping the old data and rescraping the new key', async () => {
    const { req, res, statusCalls } = adminReq({
      params: { lbusername: 'guest' },
      body: { lbusername: 'Guest2' },
    });
    await UserAdminController.updateProfile(req, res);

    expect(statusCalls).toEqual([200]);
    expect(await usersRow('guest')).toBeUndefined();
    expect(await usersRow('guest2')).toMatchObject({ displayName: 'Guest', isDiscord: false });
    expect(await db.select().from(userFilms)).toHaveLength(0);
    expect(callWorker).toHaveBeenCalledWith(
      WORKER,
      '/scrape-user',
      expect.objectContaining({ lbusername: 'guest2' }),
    );
  });

  it('keeps the Discord flag of an unregistered Discord profile across a username change', async () => {
    await db.insert(users).values({ lbusername: 'lurker', isDiscord: true });

    const { req, res, statusCalls } = adminReq({
      params: { lbusername: 'lurker' },
      body: { lbusername: 'lurker2' },
    });
    await UserAdminController.updateProfile(req, res);

    expect(statusCalls).toEqual([200]);
    expect(await usersRow('lurker2')).toMatchObject({ isDiscord: true });
  });

  it('refuses a username already in Users with 409 and changes nothing', async () => {
    await db.insert(users).values({ lbusername: 'taken', isDiscord: true });

    const { req, res, statusCalls } = adminReq({
      params: { lbusername: 'guest' },
      body: { lbusername: 'taken' },
    });
    await UserAdminController.updateProfile(req, res);

    expect(statusCalls).toEqual([409]);
    expect(await usersRow('guest')).toBeDefined();
    expect(await db.select().from(userFilms)).toHaveLength(1);
  });

  it('refuses a username change for a profile that owns MFL rosters', async () => {
    await db.insert(mflRosters).values({ lbusername: 'guest', name: 'Picks' });

    const { req, res, statusCalls } = adminReq({
      params: { lbusername: 'guest' },
      body: { lbusername: 'guest2' },
    });
    await UserAdminController.updateProfile(req, res);

    expect(statusCalls).toEqual([409]);
    expect(await db.select().from(mflRosters)).toHaveLength(1);
    expect(await usersRow('guest2')).toBeUndefined();
  });

  it('returns 404 for a profile claimed by an account', async () => {
    await seedAuthUser(ACCOUNT_ID, 'profiles-test-2@example.test');
    await db.insert(users).values({ lbusername: 'claimed', isDiscord: true });
    await db.insert(appUsers).values({ id: ACCOUNT_ID, lbusername: 'claimed' });

    const { req, res, statusCalls } = adminReq({
      params: { lbusername: 'claimed' },
      body: { name: 'Hijack' },
    });
    await UserAdminController.updateProfile(req, res);

    expect(statusCalls).toEqual([404]);
    expect(await usersRow('claimed')).toMatchObject({ displayName: null });
  });

  it('returns 404 for an unknown profile', async () => {
    const { req, res, statusCalls } = adminReq({
      params: { lbusername: 'nobody' },
      body: { name: 'X' },
    });
    await UserAdminController.updateProfile(req, res);

    expect(statusCalls).toEqual([404]);
  });

  it.each([
    [{}, 'empty body'],
    [{ name: '' }, 'blank name'],
    [{ lbusername: 'bad name' }, 'bad lbusername'],
  ])('returns 400 for %o (%s)', async (body) => {
    const { req, res, statusCalls } = adminReq({
      params: { lbusername: 'guest' },
      body,
    });
    await UserAdminController.updateProfile(req, res);

    expect(statusCalls).toEqual([400]);
  });
});
