/**
 * Test setup and teardown utilities
 * Handles seeding and cleaning the test database
 */

import { sql } from 'drizzle-orm';
import { db, dbClient } from '../db';
import {
  users,
  userRatings,
  userFilms,
  films,
  filmRatings,
  mflUserMovies,
  mflScoringTally,
} from '../db/schema';
import {
  testUsers,
  testUserRatings,
  testUserFilms,
  testFilms,
} from './fixtures/testData';

/**
 * Clean all test data from the database
 * Order matters due to foreign key constraints
 */
export async function cleanDatabase(): Promise<void> {
  // Delete in reverse order of dependencies
  await db.delete(mflScoringTally).where(sql`1=1`);
  await db.delete(mflUserMovies).where(sql`1=1`);
  await db.delete(filmRatings).where(sql`1=1`);
  await db.delete(userFilms).where(sql`1=1`);
  await db.delete(userRatings).where(sql`1=1`);
  await db.delete(films).where(sql`1=1`);
  await db.delete(users).where(sql`1=1`);
}

/**
 * Seed the database with test fixtures
 */
export async function seedDatabase(): Promise<void> {
  // Insert in order of dependencies
  if (testUsers.length > 0) {
    await db.insert(users).values(testUsers);
  }

  if (testFilms.length > 0) {
    await db.insert(films).values(testFilms);
  }

  if (testUserRatings.length > 0) {
    await db.insert(userRatings).values(testUserRatings);
  }

  if (testUserFilms.length > 0) {
    await db.insert(userFilms).values(testUserFilms);
  }
}

/**
 * Reset database to clean state with test fixtures
 */
export async function resetDatabase(): Promise<void> {
  await cleanDatabase();
  await seedDatabase();
}

/**
 * Close database connection (call in afterAll)
 */
export async function closeDatabase(): Promise<void> {
  await dbClient.end();
}

/**
 * Check if we're running against test database
 * Throws if accidentally running against production
 */
export function assertTestEnvironment(): void {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error(
      'Tests must run with NODE_ENV=test to use the test database. ' +
      'Run with: NODE_ENV=test yarn test'
    );
  }

  if (!process.env.DATABASE_URL_TEST) {
    throw new Error(
      'DATABASE_URL_TEST environment variable is required for tests. ' +
      'Add it to your .env file.'
    );
  }
}
