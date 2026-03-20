/**
 * Integration tests for eventDataController.ts
 * Tests against a dedicated test database with seeded fixtures
 *
 * Run with: yarn test
 */

import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import * as ec from "../controllers/eventDataController";
import {
  cleanDatabase,
  closeDatabase,
  assertTestEnvironment,
} from "./setup";
import {
  testAwardShows,
  testEventTemplate,
  testCategoryTemplates,
  testNomineeTemplates,
} from "./fixtures/testData";

// Verify test environment before anything runs
beforeAll(() => {
  assertTestEnvironment();
});

// Clean slate before each test to avoid ordering dependencies
beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

// ===========================
// Helpers
// ===========================

/** Seed the two test award shows and return their IDs */
async function seedAwardShows() {
  const r1 = await ec.dbCreateAwardShow(testAwardShows[0]);
  const r2 = await ec.dbCreateAwardShow(testAwardShows[1]);
  expect(r1.success).toBe(true);
  expect(r2.success).toBe(true);
  return [r1.data!, r2.data!] as const;
}

/** Seed an award show + event and return both */
async function seedEvent() {
  const [awardShow] = await seedAwardShows();
  const eventResult = await ec.dbCreateEvent({
    ...testEventTemplate,
    awardShowId: awardShow.id,
  });
  expect(eventResult.success).toBe(true);
  return { awardShow, event: eventResult.data! };
}

/** Seed award show + event + categories and return all */
async function seedCategories() {
  const { awardShow, event } = await seedEvent();
  const categories = [];
  for (const tmpl of testCategoryTemplates) {
    const result = await ec.dbUpsertCategory({
      ...tmpl,
      eventId: event.id,
    });
    expect(result.success).toBe(true);
    categories.push({ ...tmpl, id: result.data!.id, eventId: event.id });
  }
  return { awardShow, event, categories };
}

/** Seed full hierarchy: award show → event → categories → nominees */
async function seedNominees() {
  const { awardShow, event, categories } = await seedCategories();

  // Best Picture nominees (indices 0-2)
  const bestPictureCat = categories[0];
  const nominees = [];
  for (let i = 0; i < 3; i++) {
    const r = await ec.dbUpsertNominee({
      ...testNomineeTemplates[i],
      categoryId: bestPictureCat.id,
    });
    expect(r.success).toBe(true);
    nominees.push({
      ...testNomineeTemplates[i],
      id: r.data!.id,
      categoryId: bestPictureCat.id,
    });
  }

  // Best Director nominees (indices 3-4)
  const directorCat = categories[1];
  for (let i = 3; i < 5; i++) {
    const r = await ec.dbUpsertNominee({
      ...testNomineeTemplates[i],
      categoryId: directorCat.id,
    });
    expect(r.success).toBe(true);
    nominees.push({
      ...testNomineeTemplates[i],
      id: r.data!.id,
      categoryId: directorCat.id,
    });
  }

  // Best Actor nominees (indices 5-6)
  const actorCat = categories[2];
  for (let i = 5; i < 7; i++) {
    const r = await ec.dbUpsertNominee({
      ...testNomineeTemplates[i],
      categoryId: actorCat.id,
    });
    expect(r.success).toBe(true);
    nominees.push({
      ...testNomineeTemplates[i],
      id: r.data!.id,
      categoryId: actorCat.id,
    });
  }

  return { awardShow, event, categories, nominees };
}

// ===========================
// Award Show Operations
// ===========================

describe("Award Show Operations", () => {
  it("dbGetAwardShows returns all award shows ordered by name", async () => {
    await seedAwardShows();

    const result = await ec.dbGetAwardShows();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(2);
    // Alphabetical: Academy Awards before Golden Globes
    expect(result.data![0].name).toBe("Academy Awards");
    expect(result.data![1].name).toBe("Golden Globes");
  });

  it("dbGetAwardShows returns empty array when none exist", async () => {
    const result = await ec.dbGetAwardShows();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(0);
  });

  it("dbCreateAwardShow creates and returns new award show", async () => {
    const result = await ec.dbCreateAwardShow(testAwardShows[0]);

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.name).toBe("Academy Awards");
    expect(result.data!.slug).toBe("academy-awards");
    expect(result.data!.description).toBe("The Oscars");
    expect(result.data!.id).toBeDefined();
  });

  it("dbGetAwardShowBySlug returns award show with nested events", async () => {
    const { awardShow, event } = await seedEvent();

    const result = await ec.dbGetAwardShowBySlug("academy-awards");
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.name).toBe("Academy Awards");
    expect(result.data!.events).toHaveLength(1);
    expect(result.data!.events[0].slug).toBe(testEventTemplate.slug);
  });

  it("dbGetAwardShowBySlug returns null for non-existent slug", async () => {
    const result = await ec.dbGetAwardShowBySlug("non-existent");
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it("dbUpdateAwardShow updates fields", async () => {
    const [awardShow] = await seedAwardShows();

    const updateResult = await ec.dbUpdateAwardShow(awardShow.id, {
      description: "Updated description",
    });
    expect(updateResult.success).toBe(true);

    // Verify update
    const getResult = await ec.dbGetAwardShowBySlug("academy-awards");
    expect(getResult.data!.description).toBe("Updated description");
  });
});

// ===========================
// Event Operations
// ===========================

describe("Event Operations", () => {
  it("dbCreateEvent creates event linked to award show", async () => {
    const { event } = await seedEvent();

    expect(event.name).toBe(testEventTemplate.name);
    expect(event.slug).toBe(testEventTemplate.slug);
    expect(event.year).toBe(2025);
    expect(event.status).toBe("active");
    expect(event.id).toBeDefined();
  });

  it("dbGetEvents returns events with award show data", async () => {
    await seedEvent();

    const result = await ec.dbGetEvents();
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data![0].awardShowName).toBe("Academy Awards");
    expect(result.data![0].awardShowSlug).toBe("academy-awards");
  });

  it("dbGetEvents filters by status", async () => {
    const [awardShow] = await seedAwardShows();

    await ec.dbCreateEvent({
      ...testEventTemplate,
      awardShowId: awardShow.id,
      status: "active",
    });
    await ec.dbCreateEvent({
      name: "96th Academy Awards",
      slug: "96th-academy-awards",
      year: 2024,
      editionNumber: 96,
      status: "completed",
      awardShowId: awardShow.id,
    });

    const activeResult = await ec.dbGetEvents("active");
    expect(activeResult.data).toHaveLength(1);
    expect(activeResult.data![0].status).toBe("active");

    const completedResult = await ec.dbGetEvents("completed");
    expect(completedResult.data).toHaveLength(1);
    expect(completedResult.data![0].status).toBe("completed");
  });

  it("dbGetEventBySlug returns full event hierarchy", async () => {
    const { event, categories, nominees } = await seedNominees();

    const result = await ec.dbGetEventBySlug(testEventTemplate.slug);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data!.name).toBe(testEventTemplate.name);
    expect(result.data!.awardShow).toBeDefined();
    expect(result.data!.awardShow.name).toBe("Academy Awards");

    // 3 categories
    expect(result.data!.categories).toHaveLength(3);

    // Sorted by displayOrder
    expect(result.data!.categories[0].name).toBe("Best Picture");
    expect(result.data!.categories[1].name).toBe("Best Director");
    expect(result.data!.categories[2].name).toBe("Best Actor");

    // Best Picture has 3 nominees
    expect(result.data!.categories[0].nominees).toHaveLength(3);
    // Best Director has 2 nominees
    expect(result.data!.categories[1].nominees).toHaveLength(2);
    // Best Actor has 2 nominees
    expect(result.data!.categories[2].nominees).toHaveLength(2);
  });

  it("dbGetEventBySlug returns null for non-existent slug", async () => {
    const result = await ec.dbGetEventBySlug("non-existent");
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });
});

// ===========================
// Category Operations
// ===========================

describe("Category Operations", () => {
  it("dbUpsertCategory inserts new category", async () => {
    const { event } = await seedEvent();

    const result = await ec.dbUpsertCategory({
      eventId: event.id,
      name: "Best Picture",
      displayOrder: 1,
      displayMode: "movie_first",
    });

    expect(result.success).toBe(true);
    expect(result.data!.id).toBeDefined();
  });

  it("dbUpsertCategory updates existing category", async () => {
    const { event, categories } = await seedCategories();
    const catId = categories[0].id;

    const result = await ec.dbUpsertCategory({
      id: catId,
      eventId: event.id,
      name: "Best Motion Picture",
      displayOrder: 1,
      displayMode: "movie_first",
    });

    expect(result.success).toBe(true);
    expect(result.data!.id).toBe(catId);

    // Verify update via full event fetch
    const eventResult = await ec.dbGetEventBySlug(testEventTemplate.slug);
    const updatedCat = eventResult.data!.categories.find(
      (c: any) => c.id === catId
    );
    expect(updatedCat!.name).toBe("Best Motion Picture");
  });
});

// ===========================
// Nominee Operations
// ===========================

describe("Nominee Operations", () => {
  it("dbUpsertNominee inserts new nominee", async () => {
    const { categories } = await seedCategories();

    const result = await ec.dbUpsertNominee({
      categoryId: categories[0].id,
      personName: null,
      movieOrShowName: "Anora",
      isWinner: false,
    });

    expect(result.success).toBe(true);
    expect(result.data!.id).toBeDefined();
  });

  it("dbUpsertNominee updates existing nominee", async () => {
    const { nominees } = await seedNominees();
    const nomineeId = nominees[0].id;

    const result = await ec.dbUpsertNominee({
      id: nomineeId,
      categoryId: nominees[0].categoryId,
      personName: null,
      movieOrShowName: "Anora (Updated)",
      isWinner: false,
    });

    expect(result.success).toBe(true);
    expect(result.data!.id).toBe(nomineeId);
  });
});

// ===========================
// Winner Operations
// ===========================

describe("Winner Operations", () => {
  it("dbSetWinner sets nominee as winner", async () => {
    const { nominees } = await seedNominees();
    const nomineeId = nominees[0].id; // Anora in Best Picture

    const result = await ec.dbSetWinner(nomineeId, true);
    expect(result.success).toBe(true);

    // Verify via event fetch
    const eventResult = await ec.dbGetEventBySlug(testEventTemplate.slug);
    const bestPicture = eventResult.data!.categories[0];
    const winner = bestPicture.nominees.find((n: any) => n.id === nomineeId);
    expect(winner!.isWinner).toBe(true);
  });

  it("dbSetWinner clears previous winner in same category", async () => {
    const { nominees } = await seedNominees();
    // nominees[0] = Anora, nominees[1] = The Brutalist (both Best Picture)

    // Set Anora as winner
    await ec.dbSetWinner(nominees[0].id, true);

    // Set The Brutalist as winner (should clear Anora)
    await ec.dbSetWinner(nominees[1].id, true);

    // Verify
    const eventResult = await ec.dbGetEventBySlug(testEventTemplate.slug);
    const bestPicture = eventResult.data!.categories[0];
    const anora = bestPicture.nominees.find(
      (n: any) => n.id === nominees[0].id
    );
    const brutalist = bestPicture.nominees.find(
      (n: any) => n.id === nominees[1].id
    );
    expect(anora!.isWinner).toBe(false);
    expect(brutalist!.isWinner).toBe(true);
  });

  it("dbSetWinner can unset a winner", async () => {
    const { nominees } = await seedNominees();

    await ec.dbSetWinner(nominees[0].id, true);
    await ec.dbSetWinner(nominees[0].id, false);

    const eventResult = await ec.dbGetEventBySlug(testEventTemplate.slug);
    const bestPicture = eventResult.data!.categories[0];
    const allNonWinners = bestPicture.nominees.every(
      (n: any) => n.isWinner === false
    );
    expect(allNonWinners).toBe(true);
  });
});

// ===========================
// User Pick Operations
// ===========================

describe("User Pick Operations", () => {
  it("dbUpsertUserPick creates a pick", async () => {
    const { event, nominees, categories } = await seedNominees();
    const userId = "test-user-1";

    const result = await ec.dbUpsertUserPick(
      categories[0].id, // Best Picture
      userId,
      nominees[0].id // Anora
    );
    expect(result.success).toBe(true);
  });

  it("dbUpsertUserPick updates pick for same category+user", async () => {
    const { event, nominees, categories } = await seedNominees();
    const userId = "test-user-1";

    // Pick Anora
    await ec.dbUpsertUserPick(categories[0].id, userId, nominees[0].id);

    // Change to The Brutalist
    await ec.dbUpsertUserPick(categories[0].id, userId, nominees[1].id);

    // Verify only one pick exists
    const picks = await ec.dbGetEventUserPicks(event.id, userId);
    expect(picks.success).toBe(true);
    expect(picks.data).toHaveLength(1);
    expect(picks.data![0].nomineeId).toBe(nominees[1].id);
  });

  it("dbGetEventUserPicks returns all picks for a user in an event", async () => {
    const { event, nominees, categories } = await seedNominees();
    const userId = "test-user-1";

    // Pick in Best Picture
    await ec.dbUpsertUserPick(categories[0].id, userId, nominees[0].id);
    // Pick in Best Director
    await ec.dbUpsertUserPick(categories[1].id, userId, nominees[3].id);
    // Pick in Best Actor
    await ec.dbUpsertUserPick(categories[2].id, userId, nominees[5].id);

    const result = await ec.dbGetEventUserPicks(event.id, userId);
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(3);
  });

  it("dbGetEventUserPicks returns empty array for user with no picks", async () => {
    const { event } = await seedNominees();

    const result = await ec.dbGetEventUserPicks(event.id, "unknown-user");
    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(0);
  });
});
