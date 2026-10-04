/**
 * Guards the case-folding invariant added in bpdiscord — Users.lbusername is a
 * case-sensitive PK but Letterboxd usernames are case-insensitive, so a
 * BEFORE INSERT trigger lowercases every insert and the child FKs cascade on
 * update. Both live only in the migration, invisible to Drizzle.
 *
 * Run with: NODE_ENV=test yarn test
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import { eq, sql } from "drizzle-orm";

import { db } from "../db";
import { users, userFilms } from "../db/schema";
import { assertTestEnvironment, cleanDatabase, closeDatabase } from "./setup";

beforeAll(() => {
  assertTestEnvironment();
});

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe("Users lbusername case folding", () => {
  it("lowercases a mixed-case lbusername on insert", async () => {
    await db.insert(users).values({ lbusername: "MixedCaseUser", isDiscord: true });

    const rows = await db
      .select({ lbusername: users.lbusername })
      .from(users)
      .where(eq(users.lbusername, "mixedcaseuser"));

    expect(rows).toHaveLength(1);
    expect(rows[0]!.lbusername).toBe("mixedcaseuser");
  });

  it("dedupes a case-twin through the normal onConflict path", async () => {
    await db.insert(users).values({ lbusername: "doogiefeeneydo", isDiscord: false });

    await db
      .insert(users)
      .values({ lbusername: "DoogieFeeneyDO", isDiscord: true })
      .onConflictDoUpdate({ target: users.lbusername, set: { isDiscord: true } });

    const rows = await db
      .select({ lbusername: users.lbusername, isDiscord: users.isDiscord })
      .from(users)
      .where(sql`lower(${users.lbusername}) = 'doogiefeeneydo'`);

    expect(rows).toHaveLength(1);
    expect(rows[0]!.isDiscord).toBe(true);
  });

  it("cascades a key rename to UserFilms on update", async () => {
    await db.insert(users).values({ lbusername: "renameme", isDiscord: true });
    await db.insert(userFilms).values({ lbusername: "renameme", filmSlug: "a-film" });

    await db
      .update(users)
      .set({ lbusername: "renamed" })
      .where(eq(users.lbusername, "renameme"));

    const films = await db
      .select({ lbusername: userFilms.lbusername })
      .from(userFilms)
      .where(eq(userFilms.filmSlug, "a-film"));

    expect(films).toHaveLength(1);
    expect(films[0]!.lbusername).toBe("renamed");
  });
});
