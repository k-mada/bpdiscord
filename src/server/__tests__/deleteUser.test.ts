/**
 * Integration tests for deleteUserCompletely. The Supabase admin SDK is mocked
 * (createSupabaseAdminClient → fake auth.admin.deleteUser) so the auth side is
 * deterministic; the mock mirrors real cascade behaviour by deleting the
 * auth.users row. The Drizzle DB layer hits the real test database.
 */

import { sql, eq } from "drizzle-orm";
import { vi, describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

vi.mock("../config/database", async () => {
  const actual = await vi.importActual<typeof import("../config/database")>(
    "../config/database",
  );
  return { ...actual, createSupabaseAdminClient: vi.fn() };
});

import { deleteUserCompletely } from "../lib/deleteUser";
import { createSupabaseAdminClient } from "../config/database";
import { db } from "../db";
import {
  appUsers,
  users,
  userFilms,
  userRatings,
  mflFilms,
  mflUserPicks,
} from "../db/schema";
import { assertTestEnvironment, cleanDatabase, closeDatabase } from "./setup";

const ADMIN_ID = "00000000-0000-0000-0000-0000000000a1";
const TARGET_ID = "00000000-0000-0000-0000-0000000000a2";
const TEST_EMAIL_LIKE = "deleteuser-test-%@example.test";

type DeleteUserFn = ReturnType<typeof vi.fn>;

function installDeleteUserMock(): DeleteUserFn {
  const deleteUser = vi.fn(async (id: string) => {
    await db.execute(sql`DELETE FROM auth.users WHERE id = ${id}::uuid`);
    return { data: { user: null }, error: null };
  });
  vi.mocked(createSupabaseAdminClient).mockReturnValue({
    auth: { admin: { deleteUser } },
  } as never);
  return deleteUser;
}

async function seedAuthUser(id: string, email: string): Promise<void> {
  await db.execute(sql`
    INSERT INTO auth.users (id, email) VALUES (${id}::uuid, ${email})
    ON CONFLICT (id) DO NOTHING
  `);
}

async function seedProfile(lbusername: string): Promise<void> {
  await db.insert(users).values({ lbusername, isDiscord: true }).onConflictDoNothing();
  await db.insert(userFilms).values([
    { lbusername, filmSlug: "film-a", rating: 4 },
    { lbusername, filmSlug: "film-b", rating: 3 },
  ]);
  await db.insert(userRatings).values({ username: lbusername, rating: 4, count: 1 });
  await db.insert(mflFilms).values({ filmSlug: "mfl-film", title: "MFL Film", price: 1 }).onConflictDoNothing();
  await db.insert(mflUserPicks).values({ lbusername, filmSlug: "mfl-film" });
}

async function countProfileRows(lbusername: string): Promise<number> {
  const [films, ratings, picks, profile] = await Promise.all([
    db.select().from(userFilms).where(eq(userFilms.lbusername, lbusername)),
    db.select().from(userRatings).where(eq(userRatings.username, lbusername)),
    db.select().from(mflUserPicks).where(eq(mflUserPicks.lbusername, lbusername)),
    db.select().from(users).where(eq(users.lbusername, lbusername)),
  ]);
  return films.length + ratings.length + picks.length + profile.length;
}

beforeAll(async () => {
  assertTestEnvironment();
  await cleanDatabase();
});

afterAll(async () => {
  await db.execute(sql`DELETE FROM auth.users WHERE email LIKE ${TEST_EMAIL_LIKE}`);
  await closeDatabase();
});

beforeEach(async () => {
  vi.clearAllMocks();
  await cleanDatabase();
  await db.execute(sql`DELETE FROM auth.users WHERE email LIKE ${TEST_EMAIL_LIKE}`);
});

describe("deleteUserCompletely", () => {
  it("400 when neither identifier is given", async () => {
    const out = await deleteUserCompletely({ actingUserId: ADMIN_ID });
    expect(out.status).toBe(400);
    expect(createSupabaseAdminClient).not.toHaveBeenCalled();
  });

  it("404 when nothing exists on either side", async () => {
    installDeleteUserMock();
    const out = await deleteUserCompletely({
      lbusername: "ghost_user",
      actingUserId: ADMIN_ID,
    });
    expect(out.status).toBe(404);
  });

  it("blocks self-deletion with 400 (account resolves to the acting admin)", async () => {
    await seedAuthUser(ADMIN_ID, "deleteuser-test-self@example.test");
    await seedProfile("lb_admin");
    await db.insert(appUsers).values({ id: ADMIN_ID, lbusername: "lb_admin" });
    const deleteUser = installDeleteUserMock();

    const out = await deleteUserCompletely({
      lbusername: "lb_admin",
      actingUserId: ADMIN_ID,
    });

    expect(out.status).toBe(400);
    expect(deleteUser).not.toHaveBeenCalled();
    // Guard fires before any deletion — the profile survives intact.
    expect(await countProfileRows("lb_admin")).toBe(5);
  });

  it("deletes an unclaimed profile + data, no auth call", async () => {
    await seedProfile("lb_unclaimed");
    const deleteUser = installDeleteUserMock();

    const out = await deleteUserCompletely({
      lbusername: "lb_unclaimed",
      actingUserId: ADMIN_ID,
    });

    expect(out.status).toBe(200);
    expect(deleteUser).not.toHaveBeenCalled();
    const data = (out.body as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({
      profileDeleted: true,
      accountDeleted: false,
      counts: { userFilms: 2, userRatings: 1, mflPicks: 1, profile: 1 },
    });
    expect(await countProfileRows("lb_unclaimed")).toBe(0);
  });

  it("deletes both sides entering by lbusername (resolves the account)", async () => {
    await seedAuthUser(TARGET_ID, "deleteuser-test-claimed@example.test");
    await seedProfile("lb_claimed");
    await db.insert(appUsers).values({ id: TARGET_ID, lbusername: "lb_claimed" });
    const deleteUser = installDeleteUserMock();

    const out = await deleteUserCompletely({
      lbusername: "lb_claimed",
      actingUserId: ADMIN_ID,
    });

    expect(out.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith(TARGET_ID);
    expect(await countProfileRows("lb_claimed")).toBe(0);
    const remaining = await db.select().from(appUsers).where(eq(appUsers.id, TARGET_ID));
    expect(remaining).toHaveLength(0);
  });

  it("deletes both sides entering by accountId (resolves the lbusername)", async () => {
    await seedAuthUser(TARGET_ID, "deleteuser-test-byid@example.test");
    await seedProfile("lb_byid");
    await db.insert(appUsers).values({ id: TARGET_ID, lbusername: "lb_byid" });
    const deleteUser = installDeleteUserMock();

    const out = await deleteUserCompletely({
      accountId: TARGET_ID,
      actingUserId: ADMIN_ID,
    });

    expect(out.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith(TARGET_ID);
    const data = (out.body as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({ id: TARGET_ID, lbusername: "lb_byid", accountDeleted: true });
    expect(await countProfileRows("lb_byid")).toBe(0);
  });

  it("deletes a login-only account (no linked profile)", async () => {
    await seedAuthUser(TARGET_ID, "deleteuser-test-loginonly@example.test");
    await db.insert(appUsers).values({ id: TARGET_ID, lbusername: null });
    const deleteUser = installDeleteUserMock();

    const out = await deleteUserCompletely({
      accountId: TARGET_ID,
      actingUserId: ADMIN_ID,
    });

    expect(out.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith(TARGET_ID);
    const data = (out.body as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({ profileDeleted: false, accountDeleted: true });
  });

  it("502 partial when the profile deletes but the auth call fails", async () => {
    await seedAuthUser(TARGET_ID, "deleteuser-test-partial@example.test");
    await seedProfile("lb_partial");
    await db.insert(appUsers).values({ id: TARGET_ID, lbusername: "lb_partial" });
    const deleteUser = vi.fn(async () => ({
      data: { user: null },
      error: { code: "unexpected_failure", message: "boom" },
    }));
    vi.mocked(createSupabaseAdminClient).mockReturnValue({
      auth: { admin: { deleteUser } },
    } as never);
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    const out = await deleteUserCompletely({
      lbusername: "lb_partial",
      actingUserId: ADMIN_ID,
    });

    expect(out.status).toBe(502);
    const data = (out.body as { data: Record<string, unknown> }).data;
    expect(data).toMatchObject({ profileDeleted: true, accountDeleted: false });
    // DB-first: the profile is gone and the state is retryable.
    expect(await countProfileRows("lb_partial")).toBe(0);
    errSpy.mockRestore();
  });
});
