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
  cleanDatabase,
  closeDatabase,
  assertTestEnvironment,
} from './setup';
import {
  testUsers,
  testFilms,
  testUserFilms,
  expectedResults,
} from './fixtures/testData';
import { db } from '../db';
import { users, films, userFilms } from '../db/schema';

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

    it('dbGetUserWatchedCount counts all logged films (rated or not)', async () => {
      const result = await dc.dbGetUserWatchedCount('test_user_minimal');

      expect(result.success).toBe(true);
      expect(result.data).toBe(2); // matches dbGetFilmsByUser row count
    });

    it('dbGetUserWatchedCount returns 0 for a non-existent user', async () => {
      const result = await dc.dbGetUserWatchedCount('no_such_user');

      expect(result.success).toBe(true);
      expect(result.data).toBe(0);
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

    it('dbGetMovieSwap returns both directions, rating-DESC ordered', async () => {
      const result = await dc.dbGetMovieSwap('test_user_active', 'test_user_minimal');

      expect(result.success).toBe(true);

      // active has seen everything minimal has → no recs for active
      expect(result.data!.recsForUserA.map(f => f.title)).toEqual(
        expectedResults.movieSwap.activeMinimalRecsForA,
      );

      // minimal gets active's extras, highest-rated first (order significant)
      expect(result.data!.recsForUserB.map(f => f.title)).toEqual(
        expectedResults.movieSwap.activeMinimalRecsForB,
      );
      expect(result.data!.recsForUserB[0].user_rating).toBe(4.0); // New Test Film
    });

    it('dbGetMovieSwap sorts unrated (watched-only) films last via NULLS LAST', async () => {
      const result = await dc.dbGetMovieSwap('test_user_minimal', 'test_user_non_discord');

      expect(result.success).toBe(true);

      const recsForA = result.data!.recsForUserA;
      expect(recsForA.map(f => f.title)).toEqual(
        expectedResults.movieSwap.minimalNonDiscordRecsForA,
      );
      // The unrated film sorts last despite its alphabetically-first title.
      const last = recsForA[recsForA.length - 1];
      expect(last.title).toBe('Aardvark Unrated Film');
      expect(last.user_rating).toBeNull();

      expect(result.data!.recsForUserB.map(f => f.title)).toEqual(
        expectedResults.movieSwap.minimalNonDiscordRecsForB,
      );
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
      expect(result.data).toContain('test-film-no-data');
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

  describe('Top Rated Films', () => {
    // Fixtures yield (after the is_discord filter, which drops test_user_non_discord):
    //   popular  → active 4.0, minimal 4.5         → count 2, avg 4.25
    //   classic  → active 5.0, minimal 5.0         → count 2, avg 5.00
    //   divisive → active 1.5                      → count 1, avg 1.50
    //   obscure  → active 3.5                      → count 1, avg 3.50
    //   new      → active 4.0                      → count 1, avg 4.00
    //   unlisted → active 3.0                      → count 1, avg 3.00

    it('excludes non-discord raters from count and average', async () => {
      const result = await dc.dbGetTopRatedUserFilms({ minRatings: 1 });

      expect(result.success).toBe(true);
      // Popular has 3 raters in fixtures (active 4.0, minimal 4.5, non_discord 2.0)
      // but non_discord must be filtered out: count=2, avg=4.25 (not 3.5).
      const popular = result.data!.find(f => f.film_slug === 'test-film-popular');
      expect(popular?.rating_count).toBe(2);
      expect(popular?.average_rating).toBeCloseTo(4.25, 2);
    });

    it('orders by average_rating desc, then rating_count desc', async () => {
      const result = await dc.dbGetTopRatedUserFilms({ minRatings: 1 });

      const slugs = result.data!.map(f => f.film_slug);
      expect(slugs).toEqual([
        'test-film-classic',
        'test-film-popular',
        'test-film-new',
        'test-film-obscure',
        'test-film-unlisted',
        'test-film-divisive',
      ]);
    });

    it('applies minRatings as a HAVING threshold', async () => {
      const result = await dc.dbGetTopRatedUserFilms({ minRatings: 2 });

      expect(result.success).toBe(true);
      expect(result.data!.length).toBe(2);
      const slugs = result.data!.map(f => f.film_slug).sort();
      expect(slugs).toEqual(['test-film-classic', 'test-film-popular']);
    });

    it('honors the limit parameter', async () => {
      const result = await dc.dbGetTopRatedUserFilms({ limit: 2, minRatings: 1 });

      expect(result.success).toBe(true);
      expect(result.data!.length).toBe(2);
      expect(result.data![0]!.film_slug).toBe('test-film-classic');
      expect(result.data![1]!.film_slug).toBe('test-film-popular');
    });

    it('returns empty array when no film meets the default minRatings threshold', async () => {
      const result = await dc.dbGetTopRatedUserFilms();

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('aggregates distinct discord usernames into the users field', async () => {
      const result = await dc.dbGetTopRatedUserFilms({ minRatings: 1 });
      const popular = result.data!.find(f => f.film_slug === 'test-film-popular');

      // STRING_AGG(DISTINCT ...) ordering is unspecified — split + sort.
      const userList = popular!.users.split(', ').sort();
      expect(userList).toEqual(['test_user_active', 'test_user_minimal']);
      expect(userList).not.toContain('test_user_non_discord');
    });

    it('returns rating_count and average_rating as JS numbers (not strings)', async () => {
      const result = await dc.dbGetTopRatedUserFilms({ minRatings: 1 });
      const first = result.data![0]!;

      expect(typeof first.rating_count).toBe('number');
      expect(typeof first.average_rating).toBe('number');
    });
  });

  describe('Top User Films (dbGetTopUserFilms)', () => {
    // Same fixture shape as Top Rated Films above (discord-only):
    //   popular  → watch 2, rating 2, avg 4.25
    //   classic  → watch 2, rating 2, avg 5.00
    //   divisive → watch 1, rating 1, avg 1.50
    //   obscure  → watch 1, rating 1, avg 3.50
    //   new      → watch 1, rating 1, avg 4.00
    //   unlisted → watch 1, rating 1, avg 3.00

    it('defaults to MostWatched ordering (watch_count desc, title asc)', async () => {
      const result = await dc.dbGetTopUserFilms();

      expect(result.success).toBe(true);
      const slugs = result.data!.map(f => f.film_slug);
      expect(slugs).toEqual([
        'test-film-classic',
        'test-film-popular',
        'test-film-divisive',
        'test-film-new',
        'test-film-obscure',
        'test-film-unlisted',
      ]);
    });

    it('HighestRated orders by average desc, rating_count desc, slug asc', async () => {
      const result = await dc.dbGetTopUserFilms({
        orderBy: dc.TopUserFilmsOrder.HighestRated,
      });

      const slugs = result.data!.map(f => f.film_slug);
      expect(slugs).toEqual([
        'test-film-classic',
        'test-film-popular',
        'test-film-new',
        'test-film-obscure',
        'test-film-unlisted',
        'test-film-divisive',
      ]);
    });

    it('excludes non-discord watchers from watch_count and average', async () => {
      const result = await dc.dbGetTopUserFilms({
        orderBy: dc.TopUserFilmsOrder.HighestRated,
      });

      // Popular has 3 watchers in fixtures (active 4.0, minimal 4.5, non_discord 2.0)
      // but non_discord must be filtered out: watch_count=2, avg=4.25 (not 3.5).
      const popular = result.data!.find(f => f.film_slug === 'test-film-popular');
      expect(popular?.watch_count).toBe(2);
      expect(popular?.rating_count).toBe(2);
      expect(popular?.average_rating).toBeCloseTo(4.25, 2);
    });

    it('applies minRatings as a HAVING threshold only when > 0', async () => {
      const filtered = await dc.dbGetTopUserFilms({
        orderBy: dc.TopUserFilmsOrder.HighestRated,
        minRatings: 2,
      });
      expect(filtered.data!.length).toBe(2);
      expect(filtered.data!.map(f => f.film_slug).sort()).toEqual([
        'test-film-classic',
        'test-film-popular',
      ]);

      // Default minRatings=0 → no HAVING clause → all 6 films returned.
      const unfiltered = await dc.dbGetTopUserFilms();
      expect(unfiltered.data!.length).toBe(6);
    });

    it('honors the limit parameter', async () => {
      const result = await dc.dbGetTopUserFilms({ limit: 2 });

      expect(result.data!.length).toBe(2);
      expect(result.data![0]!.film_slug).toBe('test-film-classic');
      expect(result.data![1]!.film_slug).toBe('test-film-popular');
    });

    it('returns watch_count, rating_count, average_rating as JS numbers (not strings)', async () => {
      const result = await dc.dbGetTopUserFilms();
      const first = result.data![0]!;

      expect(typeof first.watch_count).toBe('number');
      expect(typeof first.rating_count).toBe('number');
      expect(typeof first.average_rating).toBe('number');
    });

    // Fixture release years: popular/classic=2020, divisive/obscure=2021,
    // new=2022, unlisted=NULL.
    it('year filter restricts to films released that year', async () => {
      const result = await dc.dbGetTopUserFilms({ year: 2020 });

      expect(result.success).toBe(true);
      // Both watch_count 2 → MostWatched tie broken by title asc.
      expect(result.data!.map(f => f.film_slug)).toEqual([
        'test-film-classic',
        'test-film-popular',
      ]);
    });

    it('year filter excludes films with a NULL release year', async () => {
      const slugs = (await dc.dbGetTopUserFilms({ year: 2021 })).data!.map(
        f => f.film_slug,
      );
      expect(slugs.sort()).toEqual(['test-film-divisive', 'test-film-obscure']);
      expect(slugs).not.toContain('test-film-unlisted');
    });

    it('year with no released films returns an empty list', async () => {
      const result = await dc.dbGetTopUserFilms({ year: 1999 });
      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });

    it('omitting year is unchanged (no release-year filter applied)', async () => {
      const result = await dc.dbGetTopUserFilms();
      expect(result.data!.length).toBe(6);
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

// The HighestRated path selects MEMBERSHIP by a Bayesian-weighted score, then
// presents the chosen set by raw average. This block is isolated because the
// weighted score depends on the global mean over ALL ratings — so it controls
// the entire rating population, then restores the standard fixtures afterward.
describe('dbGetTopUserFilms — highest-rated membership gate', () => {
  // 2020 pool: FLUKE 5.0 from 2 raters, SOLID 4.5 from 6. ANCHOR (1990) only
  // drags the global mean down; the year filter keeps it out of the pool.
  //   c = (2*5 + 6*4.5 + 8*1) / 16 = 2.8125,  m = 10
  //   adj(FLUKE) = 2/12*5  + 10/12*c ≈ 3.18
  //   adj(SOLID) = 6/16*4.5 + 10/16*c ≈ 3.45  → SOLID wins selection
  beforeAll(async () => {
    await cleanDatabase();
    await db.insert(users).values(
      Array.from({ length: 8 }, (_, i) => ({
        lbusername: `gate_u${i + 1}`,
        isDiscord: true,
      })),
    );
    await db.insert(films).values([
      { filmSlug: 'gate-fluke', title: 'Fluke', releaseYear: 2020 },
      { filmSlug: 'gate-solid', title: 'Solid', releaseYear: 2020 },
      { filmSlug: 'gate-anchor', title: 'Anchor', releaseYear: 1990 },
    ]);
    const rows: { filmSlug: string; lbusername: string; rating: number }[] = [];
    for (let i = 1; i <= 2; i++)
      rows.push({ filmSlug: 'gate-fluke', lbusername: `gate_u${i}`, rating: 5.0 });
    for (let i = 1; i <= 6; i++)
      rows.push({ filmSlug: 'gate-solid', lbusername: `gate_u${i}`, rating: 4.5 });
    for (let i = 1; i <= 8; i++)
      rows.push({ filmSlug: 'gate-anchor', lbusername: `gate_u${i}`, rating: 1.0 });
    await db.insert(userFilms).values(rows);
  });

  afterAll(async () => {
    await resetDatabase();
  });

  it('drops a high-average low-sample film for a well-sampled one when the limit binds', async () => {
    const result = await dc.dbGetTopUserFilms({
      orderBy: dc.TopUserFilmsOrder.HighestRated,
      year: 2020,
      minRatings: 2,
      m: 10,
      limit: 1,
    });
    // Naive top-1-by-average would return the 5.0 fluke; the gate prefers the
    // confidence-weighted winner.
    expect(result.data!.map((f) => f.film_slug)).toEqual(['gate-solid']);
  });

  it('presents the selected set by raw average desc, not by the weighted score', async () => {
    const result = await dc.dbGetTopUserFilms({
      orderBy: dc.TopUserFilmsOrder.HighestRated,
      year: 2020,
      minRatings: 2,
      m: 10,
      limit: 25,
    });
    // Both qualify; display order is by raw average → the 5.0 fluke is shown
    // first even though it lost the (hidden) selection tiebreak.
    expect(result.data!.map((f) => f.film_slug)).toEqual([
      'gate-fluke',
      'gate-solid',
    ]);
    expect(result.data![0]!.average_rating).toBeCloseTo(5.0, 2);
    expect(result.data![1]!.average_rating).toBeCloseTo(4.5, 2);
  });
});
