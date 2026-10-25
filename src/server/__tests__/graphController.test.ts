/**
 * Tests for graphController.ts — the actor-graph endpoints.
 *
 * Two layers:
 *  - classifyError: pure unit tests of the status-mapping contract.
 *  - findActorPath / reads: DB-backed against a small seeded ag_* graph.
 *
 * The seeded actors are all fully_fetched, so ensureActor short-circuits on
 * the DB row and no handler here reaches TMDB. The cache-through ingestion
 * paths (ensureActor/ensureMovieWithCast hitting TMDB) are a separate task.
 *
 * Run with: yarn test
 */

import { vi, describe, it, expect, beforeAll, afterAll } from "vitest";
import { AxiosError } from "axios";
import { sql } from "drizzle-orm";
import { db } from "../db";
import { agActors, agFilms, agActedIn } from "../db/schema";
import { mockReqRes } from "./helpers/mockReqRes";
import { assertTestEnvironment, closeDatabase } from "./setup";
import {
  classifyError,
  TmdbNotFoundError,
  TmdbUnavailableError,
  findActorPath,
  getActor,
  getMovie,
  getCostars,
  getCommonMovies,
} from "../controllers/graphController";

const ALICE = 1;
const BOB = 2;
const CAROL = 3;
const DAVE = 4; // isolated — no edges
const EVE = 5; // reachable from Alice only through a high-billing credit

const FILM_X = 100; // Alice + Bob
const FILM_Y = 200; // Bob + Carol
const FILM_Z = 300; // Alice + Eve (Eve billed 40th)

async function cleanGraph(): Promise<void> {
  await db.delete(agActedIn).where(sql`1=1`);
  await db.delete(agActors).where(sql`1=1`);
  await db.delete(agFilms).where(sql`1=1`);
}

async function seedGraph(): Promise<void> {
  await db.insert(agActors).values([
    { tmdbId: ALICE, name: "Alice", popularity: 50, fullyFetched: true },
    { tmdbId: BOB, name: "Bob", popularity: 40, fullyFetched: true },
    { tmdbId: CAROL, name: "Carol", popularity: 30, fullyFetched: true },
    { tmdbId: DAVE, name: "Dave", popularity: 20, fullyFetched: true },
    { tmdbId: EVE, name: "Eve", popularity: 10, fullyFetched: true },
  ]);
  await db.insert(agFilms).values([
    { tmdbId: FILM_X, title: "Film X", releaseYear: 2001, castFullyFetched: true },
    { tmdbId: FILM_Y, title: "Film Y", releaseYear: 2002 },
    { tmdbId: FILM_Z, title: "Film Z", releaseYear: 2003 },
  ]);
  await db.insert(agActedIn).values([
    { actorTmdbId: ALICE, movieTmdbId: FILM_X, billingOrder: 0 },
    { actorTmdbId: BOB, movieTmdbId: FILM_X, billingOrder: 1 },
    { actorTmdbId: BOB, movieTmdbId: FILM_Y, billingOrder: 0 },
    { actorTmdbId: CAROL, movieTmdbId: FILM_Y, billingOrder: 1 },
    { actorTmdbId: ALICE, movieTmdbId: FILM_Z, billingOrder: 0 },
    { actorTmdbId: EVE, movieTmdbId: FILM_Z, billingOrder: 40 },
  ]);
}

beforeAll(async () => {
  assertTestEnvironment();
  await cleanGraph();
  await seedGraph();
});

afterAll(async () => {
  await cleanGraph();
  await closeDatabase();
});

describe("classifyError", () => {
  it("maps TmdbNotFoundError to 404", () => {
    expect(classifyError(new TmdbNotFoundError("nope"), "x").status).toBe(404);
  });

  it("maps TmdbUnavailableError to 503 and keeps its message", () => {
    const { status, body } = classifyError(
      new TmdbUnavailableError("token missing"),
      "x",
    );
    expect(status).toBe(503);
    expect(body).toMatchObject({ message: "token missing" });
  });

  it("maps an upstream 429 to 429", () => {
    const err = new AxiosError("rate limited");
    err.response = { status: 429 } as never;
    expect(classifyError(err, "x").status).toBe(429);
  });

  it("maps any other AxiosError to 502 with the upstream status", () => {
    const err = new AxiosError("bad gateway");
    err.response = { status: 500 } as never;
    const { status, body } = classifyError(err, "x");
    expect(status).toBe(502);
    expect(body).toMatchObject({ details: { upstreamStatus: 500 } });
  });

  it("reports a null upstream status when the AxiosError has no response", () => {
    const { body } = classifyError(new AxiosError("no response"), "x");
    expect(body).toMatchObject({ details: { upstreamStatus: null } });
  });

  it("maps an unknown error to 500", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(classifyError(new Error("boom"), "do a thing").status).toBe(500);
    spy.mockRestore();
  });
});

describe("findActorPath", () => {
  it("rejects a non-integer actor id with 400", async () => {
    const { req, res, statusCalls } = mockReqRes({
      params: { actor1Id: "abc", actor2Id: "2" },
    });
    await findActorPath(req, res);
    expect(statusCalls).toEqual([400]);
  });

  it("enforces the documented maxDepth range of 1..8", async () => {
    const statusFor = async (maxDepth: string) => {
      const { req, res, statusCalls } = mockReqRes({
        params: { actor1Id: "1", actor2Id: "2" },
        query: { maxDepth },
      });
      await findActorPath(req, res);
      return statusCalls;
    };
    expect(await statusFor("0")).toEqual([400]);
    expect(await statusFor("9")).toEqual([400]);
    // "8" is the max; it must run the search, not 400.
    expect(await statusFor("8")).toEqual([]);
  });

  it("enforces the documented billingCutoff range of 1..50", async () => {
    const statusFor = async (billingCutoff: string) => {
      const { req, res, statusCalls } = mockReqRes({
        params: { actor1Id: "1", actor2Id: "2" },
        query: { billingCutoff },
      });
      await findActorPath(req, res);
      return statusCalls;
    };
    expect(await statusFor("0")).toEqual([400]);
    expect(await statusFor("51")).toEqual([400]);
    expect(await statusFor("50")).toEqual([]);
  });

  it("returns degrees 0 for the same actor", async () => {
    const { req, res, jsonCalls } = mockReqRes({
      params: { actor1Id: "1", actor2Id: "1" },
    });
    await findActorPath(req, res);
    const { data } = jsonCalls[0] as { data: { degrees: number; path: unknown[] } };
    expect(data.degrees).toBe(0);
    expect(data.path).toHaveLength(1);
  });

  it("finds a one-degree link through a shared film", async () => {
    const { req, res, jsonCalls } = mockReqRes({
      params: { actor1Id: "1", actor2Id: "2" },
    });
    await findActorPath(req, res);
    const { data } = jsonCalls[0] as {
      data: {
        degrees: number;
        path: Array<{ kind: string; tmdbId: number }>;
      };
    };
    expect(data.degrees).toBe(1);
    expect(data.path.map((s) => s.kind)).toEqual(["actor", "film", "actor"]);
    expect(data.path[0].tmdbId).toBe(ALICE);
    expect(data.path[1].tmdbId).toBe(FILM_X);
    expect(data.path[2].tmdbId).toBe(BOB);
  });

  it("finds a two-degree link through an intermediate actor", async () => {
    const { req, res, jsonCalls } = mockReqRes({
      params: { actor1Id: "1", actor2Id: "3" },
    });
    await findActorPath(req, res);
    const { data } = jsonCalls[0] as { data: { degrees: number } };
    expect(data.degrees).toBe(2);
  });

  it("returns degrees null and an empty path for an unreachable actor", async () => {
    const { req, res, statusCalls, jsonCalls } = mockReqRes({
      params: { actor1Id: "1", actor2Id: String(DAVE) },
    });
    await findActorPath(req, res);
    expect(statusCalls).toEqual([]);
    const { data } = jsonCalls[0] as { data: { degrees: number | null; path: unknown[] } };
    expect(data.degrees).toBeNull();
    expect(data.path).toEqual([]);
  });

  it("prunes a credit billed below the cutoff, then finds it when the cutoff widens", async () => {
    const pruned = mockReqRes({ params: { actor1Id: "1", actor2Id: String(EVE) } });
    await findActorPath(pruned.req, pruned.res);
    expect((pruned.jsonCalls[0] as { data: { degrees: number | null } }).data.degrees).toBeNull();

    const widened = mockReqRes({
      params: { actor1Id: "1", actor2Id: String(EVE) },
      query: { billingCutoff: "50" },
    });
    await findActorPath(widened.req, widened.res);
    expect((widened.jsonCalls[0] as { data: { degrees: number } }).data.degrees).toBe(1);
  });
});

describe("graph reads", () => {
  it("getActor returns a seeded, fully-fetched actor", async () => {
    const { req, res, statusCalls, jsonCalls } = mockReqRes({
      params: { tmdbId: "1" },
    });
    await getActor(req, res);
    expect(statusCalls).toEqual([]);
    expect(jsonCalls[0]).toMatchObject({ data: { tmdbId: ALICE, name: "Alice" } });
  });

  it("getMovie returns a cast-fetched film with its principal cast", async () => {
    const { req, res, statusCalls, jsonCalls } = mockReqRes({
      params: { tmdbId: String(FILM_X) },
    });
    await getMovie(req, res);
    expect(statusCalls).toEqual([]);
    const { data } = jsonCalls[0] as { data: { title: string; cast: unknown[] } };
    expect(data.title).toBe("Film X");
    expect(data.cast).toHaveLength(2);
  });

  it("getCostars returns an actor's co-stars across shared films", async () => {
    const { req, res, statusCalls, jsonCalls } = mockReqRes({
      params: { tmdbId: String(BOB) },
    });
    await getCostars(req, res);
    expect(statusCalls).toEqual([]);
    const { data } = jsonCalls[0] as {
      data: { costars: Array<{ tmdbId: number }>; count: number };
    };
    expect(data.count).toBe(2);
    expect(data.costars.map((c) => c.tmdbId).sort()).toEqual([ALICE, CAROL]);
  });

  it("enforces the documented co-stars limit range of 1..500", async () => {
    const statusFor = async (limit: string) => {
      const { req, res, statusCalls } = mockReqRes({
        params: { tmdbId: String(BOB) },
        query: { limit },
      });
      await getCostars(req, res);
      return statusCalls;
    };
    expect(await statusFor("0")).toEqual([400]);
    expect(await statusFor("501")).toEqual([400]);
    expect(await statusFor("500")).toEqual([]);
  });

  it("getCommonMovies returns the films two actors share", async () => {
    const { req, res, statusCalls, jsonCalls } = mockReqRes({
      params: { actor1Id: "1", actor2Id: "2" },
    });
    await getCommonMovies(req, res);
    expect(statusCalls).toEqual([]);
    const { data } = jsonCalls[0] as {
      data: { commonMovies: Array<{ tmdbId: number }>; count: number };
    };
    expect(data.count).toBe(1);
    expect(data.commonMovies[0].tmdbId).toBe(FILM_X);
  });

  it("maps a DB failure through classifyError to 500", async () => {
    const spy = vi
      .spyOn(db, "execute")
      .mockRejectedValueOnce(new Error("db down"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const { req, res, statusCalls, jsonCalls } = mockReqRes({
      params: { actor1Id: "1", actor2Id: "2" },
    });
    await getCommonMovies(req, res);
    expect(statusCalls).toEqual([500]);
    expect(jsonCalls[0]).toMatchObject({ error: "Failed to get common movies" });
    spy.mockRestore();
    consoleSpy.mockRestore();
  });
});
