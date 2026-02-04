/**
 * Integration tests for dataController.ts
 * Tests against a dedicated test database with seeded fixtures
 *
 * Run with: yarn test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import * as dc from '../controllers/dataController';
import {
  resetDatabase,
  closeDatabase,
  assertTestEnvironment,
} from './setup';
import {
  testUsers,
  testFilms,
  testUserFilms,
  expectedResults,
} from './fixtures/testData';

// Verify test environment before anything runs
beforeAll(async () => {
  assertTestEnvironment();
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('dataController', () => {
  describe('User Ratings', () => {
    it('dbGetAllUsernames returns users who have ratings', async () => {
      const result = await dc.dbGetAllUsernames();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      // Only users with entries in userRatings table are returned (3 of 4 test users)
      expect(result.data!.length).toBe(3);

      // Verify display names are populated
      const activeUser = result.data!.find(u => u.username === 'test_user_active');
      expect(activeUser?.displayName).toBe('Active Test User');
    });

    it('dbGetUserRatings returns correct rating distribution', async () => {
      const result = await dc.dbGetUserRatings('test_user_active');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBe(10); // 10 rating levels for active user

      // Verify sorted by rating
      const ratings = result.data!.map(r => r.rating);
      expect(ratings).toEqual([0.5, 1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0]);
    });

    it('dbGetUserRatings returns empty array for non-existent user', async () => {
      const result = await dc.dbGetUserRatings('nonexistent_user');

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('Hater Rankings', () => {
    it('dbGetHaterRankings returns users sorted by average rating', async () => {
      const result = await dc.dbGetHaterRankings();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      // Only users with entries in userRatings table are returned (3 of 4 test users)
      expect(result.data!.length).toBe(3);

      // Verify sorted ascending (lowest average first = biggest "hater")
      const averages = result.data!.map(r => r.averageRating);
      for (let i = 1; i < averages.length; i++) {
        expect(averages[i]).toBeGreaterThanOrEqual(averages[i - 1]!);
      }

      // Active user should have lower average than minimal user
      const activeIdx = result.data!.findIndex(r => r.username === 'test_user_active');
      const minimalIdx = result.data!.findIndex(r => r.username === 'test_user_minimal');
      expect(activeIdx).toBeLessThan(minimalIdx);
    });

    it('dbGetHaterRankings includes rating distribution', async () => {
      const result = await dc.dbGetHaterRankings();

      const activeUser = result.data!.find(r => r.username === 'test_user_active');
      expect(activeUser?.ratingDistribution).toBeDefined();
      expect(activeUser?.ratingDistribution.length).toBe(10);
      expect(activeUser?.totalRatings).toBe(200); // Sum of all counts
    });
  });

  describe('User Profile', () => {
    it('dbGetUserProfile returns full profile for existing user', async () => {
      const result = await dc.dbGetUserProfile('test_user_active');

      expect(result.success).toBe(true);
      expect(result.data).not.toBeNull();
      expect(result.data!.username).toBe('test_user_active');
      expect(result.data!.displayName).toBe('Active Test User');
      expect(result.data!.followers).toBe(100);
      expect(result.data!.following).toBe(50);
      expect(result.data!.numberOfLists).toBe(5);
    });

    it('dbGetUserProfile returns null for non-existent user', async () => {
      const result = await dc.dbGetUserProfile('nonexistent_user');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
    });
  });

  describe('User Films', () => {
    it('dbGetAllUserFilms returns distinct films', async () => {
      const result = await dc.dbGetAllUserFilms();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Should have unique film slugs
      const slugs = result.data!.map(f => f.film_slug);
      const uniqueSlugs = [...new Set(slugs)];
      expect(slugs.length).toBe(uniqueSlugs.length);
    });

    it('dbGetUserFilms returns films for specific user', async () => {
      const result = await dc.dbGetUserFilms('test_user_active');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBe(6); // Active user has 6 films (including unlisted)

      // Verify film data structure
      const popularFilm = result.data!.find(f => f.film_slug === 'test-film-popular');
      expect(popularFilm?.title).toBe('Popular Test Film');
      expect(popularFilm?.rating).toBe(4.0);
      expect(popularFilm?.liked).toBe(true);
    });

    it('dbGetUserFilmsCount returns count for discord users only', async () => {
      const result = await dc.dbGetUserFilmsCount();

      expect(result.success).toBe(true);
      expect(result.data).toBe(expectedResults.discordUserFilmsCount);
    });

    it('dbGetFilmsByUser returns films with metadata', async () => {
      const result = await dc.dbGetFilmsByUser('test_user_minimal');

      expect(result.success).toBe(true);
      expect(result.data!.length).toBe(2); // Minimal user has 2 films

      result.data!.forEach(film => {
        expect(film).toHaveProperty('title');
        expect(film).toHaveProperty('film_slug');
        expect(film).toHaveProperty('rating');
        expect(film).toHaveProperty('liked');
        expect(film).toHaveProperty('created_at');
        expect(film).toHaveProperty('updated_at');
      });
    });
  });

  describe('Film Comparisons', () => {
    it('dbGetMoviesInCommon returns films both users have seen', async () => {
      const result = await dc.dbGetMoviesInCommon('test_user_active', 'test_user_minimal');

      expect(result.success).toBe(true);
      expect(result.count).toBe(2); // Popular and Classic
      expect(result.data!.length).toBe(2);

      const titles = result.data!.map(f => f.title).sort();
      expect(titles).toEqual(expectedResults.moviesInCommonActiveMinimal);

      // Verify ratings from both users are included
      const popularFilm = result.data!.find(f => f.title === 'Popular Test Film');
      expect(popularFilm?.user1_rating).toBe(4.0); // Active user's rating
      expect(popularFilm?.user2_rating).toBe(4.5); // Minimal user's rating
    });

    it('dbGetMoviesInCommon returns empty for users with no overlap', async () => {
      const result = await dc.dbGetMoviesInCommon('test_user_no_films', 'test_user_active');

      expect(result.success).toBe(true);
      expect(result.count).toBe(0);
      expect(result.data).toEqual([]);
    });

    it('dbGetMovieSwap returns films user1 has that user2 does not', async () => {
      const result = await dc.dbGetMovieSwap('test_user_active', 'test_user_minimal');

      expect(result.success).toBe(true);
      expect(result.data!.length).toBe(4); // Divisive, New, Obscure, Unlisted

      const titles = result.data!.map(f => f.title).sort();
      expect(titles).toEqual(expectedResults.movieSwapActiveToMinimal);
    });
  });

  describe('Film Ratings (LB)', () => {
    it('dbGetLBFilms returns all films', async () => {
      const result = await dc.dbGetLBFilms();

      expect(result.success).toBe(true);
      expect(result.data!.length).toBe(testFilms.length);
    });

    it('dbGetLBFilmRatings returns ratings for specified films', async () => {
      // Note: This tests the filmRatings table, which we haven't seeded
      // In real usage, this would have aggregated rating data
      const result = await dc.dbGetLBFilmRatings(['test-film-popular']);

      expect(result.success).toBe(true);
      // Empty because we didn't seed filmRatings table
      expect(result.data).toEqual([]);
    });

    it('dbGetLBFilmRatings returns empty array for empty input', async () => {
      const result = await dc.dbGetLBFilmRatings([]);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('Ratings Distribution', () => {
    it('dbGetTotalRatingsDistribution aggregates discord user ratings', async () => {
      const result = await dc.dbGetTotalRatingsDistribution();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();

      // Should only include ratings from discord users
      // and exclude 0 ratings
      result.data!.forEach(r => {
        expect(r.rating).toBeGreaterThan(0);
        expect(r.count).toBeGreaterThan(0);
      });
    });
  });

  describe('Missing Films', () => {
    it('dbGetMissingFilms returns films in UserFilms but not in Films table', async () => {
      const result = await dc.dbGetMissingFilms();

      expect(result.success).toBe(true);
      expect(result.data).toContain('test-film-unlisted');
    });
  });

  describe('MFL Scoring', () => {
    it('dbGetMFLScoringMetrics returns empty when no metrics seeded', async () => {
      const result = await dc.dbGetMFLScoringMetrics();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('dbGetMFLMovies returns empty when no MFL movies seeded', async () => {
      const result = await dc.dbGetMFLMovies();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('Mutation Operations', () => {
    it('dbUpsertUserProfile creates new user', async () => {
      const newUser = {
        displayName: 'New Test User',
        followers: 10,
        following: 5,
        numberOfLists: 1,
      };

      const result = await dc.dbUpsertUserProfile('test_user_new', newUser);
      expect(result.success).toBe(true);

      // Verify it was created
      const profile = await dc.dbGetUserProfile('test_user_new');
      expect(profile.data?.displayName).toBe('New Test User');
    });

    it('dbUpsertUserProfile updates existing user', async () => {
      const updates = {
        displayName: 'Updated Display Name',
        followers: 200,
        following: 100,
        numberOfLists: 10,
      };

      const result = await dc.dbUpsertUserProfile('test_user_active', updates);
      expect(result.success).toBe(true);

      // Verify it was updated
      const profile = await dc.dbGetUserProfile('test_user_active');
      expect(profile.data?.displayName).toBe('Updated Display Name');
      expect(profile.data?.followers).toBe(200);
    });

    it('dbDeleteUserRatings removes all ratings for user', async () => {
      // First verify ratings exist
      const before = await dc.dbGetUserRatings('test_user_minimal');
      expect(before.data!.length).toBeGreaterThan(0);

      // Delete
      const result = await dc.dbDeleteUserRatings('test_user_minimal');
      expect(result.success).toBe(true);

      // Verify deleted
      const after = await dc.dbGetUserRatings('test_user_minimal');
      expect(after.data).toEqual([]);
    });
  });
});
