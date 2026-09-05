/**
 * Integration tests for dataController.ts
 * Tests against a dedicated test database with seeded fixtures
 *
 * Run with: yarn test
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { sql } from 'drizzle-orm';
import * as dc from '../controllers/dataController';
import {
  resetDatabase,
  cleanDatabase,
  closeDatabase,
  assertTestEnvironment,
} from './setup';
import {
  testFilms,
  expectedResults,
} from './fixtures/testData';
import { db } from '../db';
import {
  users,
  films,
  userFilms,
  mflFilms,
  mflUserPicks,
  mflScoringMetrics,
  mflScoringTally,
} from '../db/schema';

beforeAll(async () => {
  assertTestEnvironment();
  await resetDatabase();
});

afterAll(async () => {
  await closeDatabase();
});

describe('dataController', () => {
  describe('User Ratings', () => {
    it('dbGetAllUsernames returns every user, ratings imported or not', async () => {
      const result = await dc.dbGetAllUsernames();

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      // Reads Users directly rather than joining UserRatings, so an account that
      // has not imported ratings yet still appears. All 4 test users, including
      // test_user_no_films.
      expect(result.data!.length).toBe(4);
      expect(result.data!.map((u) => u.username)).toContain('test_user_no_films');

      const activeUser = result.data!.find(u => u.username === 'test_user_active');
      expect(activeUser?.displayName).toBe('Active Test User');
    });

    it('dbGetUserRatings returns correct rating distribution', async () => {
      const result = await dc.dbGetUserRatings('test_user_active');

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      expect(result.data!.length).toBe(10); // 10 rating levels for active user

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

  describe('Film Detail', () => {
    // test-film-popular fixtures: active 4.0 + minimal 4.5 (discord),
    // non_discord 2.0 — so the toggle moves the average 4.25 → 3.50.
    it('dbGetFilmDetail returns discord-scoped stats and film metadata', async () => {
      const result = await dc.dbGetFilmDetail('test-film-popular');

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        filmSlug: 'test-film-popular',
        title: 'Popular Test Film',
        releaseYear: 2020,
        letterboxdRating: 4.2,
        watchedCount: 2,
        ratedCount: 2,
        averageRating: 4.25,
      });
    });

    it('dbGetFilmDetail orders raters by rating descending', async () => {
      const result = await dc.dbGetFilmDetail('test-film-popular');

      expect(result.data!.ratings.map(r => r.username)).toEqual([
        'test_user_minimal',
        'test_user_active',
      ]);
      expect(result.data!.ratings[0]!.displayName).toBe('Minimal User');
    });

    it('dbGetFilmDetail includes non-discord raters when toggled on', async () => {
      const result = await dc.dbGetFilmDetail('test-film-popular', {
        includeNonDiscord: true,
      });

      expect(result.data!.watchedCount).toBe(3);
      expect(result.data!.ratedCount).toBe(3);
      expect(result.data!.averageRating).toBe(3.5);
      expect(result.data!.ratings.map(r => r.username)).toContain(
        'test_user_non_discord',
      );
    });

    it('dbGetFilmDetail counts a null rating as watched but not rated', async () => {
      // test-film-unrated is watched (rating null) by the non-discord user only.
      const result = await dc.dbGetFilmDetail('test-film-unrated', {
        includeNonDiscord: true,
      });

      expect(result.data!.watchedCount).toBe(1);
      expect(result.data!.ratedCount).toBe(0);
      expect(result.data!.averageRating).toBeNull();
      expect(result.data!.ratings).toEqual([]);
    });

    it('dbGetFilmDetail resolves a slug with no Films row, falling back to the UserFilms title', async () => {
      const result = await dc.dbGetFilmDetail('test-film-no-data', {
        includeNonDiscord: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toMatchObject({
        title: 'No Data Film',
        poster: null,
        letterboxdRating: null,
        releaseYear: null,
        watchedCount: 1,
        ratedCount: 1,
      });
    });

    it('dbGetFilmDetail still resolves a film only non-discord users logged', async () => {
      const result = await dc.dbGetFilmDetail('test-film-no-data');

      expect(result.data).not.toBeNull();
      expect(result.data!.watchedCount).toBe(0);
      expect(result.data!.ratings).toEqual([]);
    });

    it('dbGetFilmDetail returns null for a slug in neither Films nor UserFilms', async () => {
      const result = await dc.dbGetFilmDetail('no-such-film-anywhere');

      expect(result.success).toBe(true);
      expect(result.data).toBeNull();
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

    describe('with a seeded season', () => {
      const PICKER = 'test_user_active';
      const OTHER = 'test_user_minimal';

      beforeAll(async () => {
        await db.insert(mflFilms).values([
          { filmSlug: 'zulu-dawn', title: 'Zulu Dawn', price: 10 },
          { filmSlug: 'anatomy-of-a-fall', title: 'Anatomy of a Fall', price: 30 },
          { filmSlug: 'nobody-picked-me', title: 'Nobody Picked Me', price: 5 },
        ]);
        await db.insert(mflScoringMetrics).values([
          { metricId: 9001, metricName: 'Oscars', category: 'awards', pointValue: 25 },
          { metricId: 9002, metricName: 'Box Office', category: 'box_office', pointValue: 10 },
          { metricId: 9003, metricName: 'Globes', category: 'awards', pointValue: 5 },
          { metricId: 9004, metricName: 'Mystery', category: null, pointValue: 3 },
        ]);
        await db.insert(mflScoringTally).values([
          { filmSlug: 'anatomy-of-a-fall', metricId: 9001, pointsAwarded: 25 },
          { filmSlug: 'anatomy-of-a-fall', metricId: 9002, pointsAwarded: 10 },
          { filmSlug: 'anatomy-of-a-fall', metricId: 9003, pointsAwarded: 5 },
          { filmSlug: 'anatomy-of-a-fall', metricId: 9004, pointsAwarded: 3 },
          // A null award, which must count as 0 rather than poison the sum.
          { filmSlug: 'nobody-picked-me', metricId: 9001, pointsAwarded: null },
        ]);
        await db.insert(mflUserPicks).values([
          { lbusername: PICKER, filmSlug: 'anatomy-of-a-fall' },
        ]);
      });

      afterAll(async () => {
        await db.delete(mflScoringTally).where(sql`1=1`);
        await db.delete(mflScoringMetrics).where(sql`1=1`);
        await db.delete(mflUserPicks).where(sql`1=1`);
        await db.delete(mflFilms).where(sql`1=1`);
      });

      it('dbGetMFLMovies lists a film nobody picked', async () => {
        const result = await dc.dbGetMFLMovies();

        expect(result.data!.map((m) => m.film_slug)).toContain('nobody-picked-me');
      });

      it('dbGetMFLMovies orders by title and returns one row per film', async () => {
        const result = await dc.dbGetMFLMovies();

        expect(result.data!.map((m) => m.film_slug)).toEqual([
          'anatomy-of-a-fall',
          'nobody-picked-me',
          'zulu-dawn',
        ]);
      });

      // SUM widens bigint to numeric and COUNT is bigint; postgres.js hands both
      // back as strings, which sort lexically and concatenate under +.
      it('dbGetMFLMovies returns points as numbers, not numeric strings', async () => {
        const result = await dc.dbGetMFLMovies();
        const scored = result.data!.find((m) => m.film_slug === 'anatomy-of-a-fall')!;

        expect(typeof scored.total_points).toBe('number');
        for (const points of Object.values(scored.points_by_category)) {
          expect(typeof points).toBe('number');
        }
      });

      it('dbGetMFLMovies sums two metrics sharing a category and splits the rest', async () => {
        const result = await dc.dbGetMFLMovies();
        const scored = result.data!.find((m) => m.film_slug === 'anatomy-of-a-fall')!;

        expect(scored.points_by_category).toEqual({
          awards: 30,
          box_office: 10,
          uncategorised: 3,
        });
        expect(scored.total_points).toBe(43);
      });

      it('dbGetMFLMovies gives an unscored film zero and an empty category map', async () => {
        const result = await dc.dbGetMFLMovies();
        const unscored = result.data!.find((m) => m.film_slug === 'zulu-dawn')!;

        expect(unscored.total_points).toBe(0);
        expect(unscored.points_by_category).toEqual({});
      });

      it('dbGetMFLMovies counts a null award as zero without dropping the bucket', async () => {
        const result = await dc.dbGetMFLMovies();
        const nulled = result.data!.find((m) => m.film_slug === 'nobody-picked-me')!;

        expect(nulled.total_points).toBe(0);
        expect(nulled.points_by_category).toEqual({ awards: 0 });
      });

      it('dbGetMFLMovies carries price and release date through', async () => {
        const result = await dc.dbGetMFLMovies();
        const scored = result.data!.find((m) => m.film_slug === 'anatomy-of-a-fall')!;

        expect(scored.price).toBe(30);
        expect(scored.release_date).toBeNull();
      });

      it('dbGetMFLUserScores resolves through the user picks', async () => {
        const result = await dc.dbGetMFLUserScores(PICKER);

        expect(result.success).toBe(true);
        expect(result.data).toEqual(
          expect.arrayContaining([
            { username: PICKER, metric_id: 9001, points_awarded: 25, category: 'awards' },
            { username: PICKER, metric_id: 9002, points_awarded: 10, category: 'box_office' },
          ]),
        );
      });

      it('dbGetMFLUserScores buckets a null category the same way the catalogue does', async () => {
        const result = await dc.dbGetMFLUserScores(PICKER);
        const catalogue = await dc.dbGetMFLMovies();
        const scored = catalogue.data!.find((m) => m.film_slug === 'anatomy-of-a-fall')!;

        const uncategorised = result.data!.filter((r) => r.metric_id === 9004);
        expect(uncategorised).toHaveLength(1);
        expect(uncategorised[0]!.category).toBe('uncategorised');
        expect(Object.keys(scored.points_by_category)).toContain(
          uncategorised[0]!.category,
        );
      });

      it('dbGetMFLUserScores excludes awards for films the user did not pick', async () => {
        const result = await dc.dbGetMFLUserScores(PICKER);

        expect(result.data!.every((r) => r.points_awarded !== 25 || r.metric_id === 9001)).toBe(true);
        expect(result.data).toHaveLength(4);
      });

      it('dbGetMflUserPicks returns only the caller\'s own roster', async () => {
        const mine = await dc.dbGetMflUserPicks(PICKER);
        const theirs = await dc.dbGetMflUserPicks(OTHER);

        expect(mine.data!.map((p) => p.film_slug)).toEqual(['anatomy-of-a-fall']);
        expect(theirs.data).toEqual([]);
      });

      it('dbGetMflUserPicks totals a pick the same way the catalogue does', async () => {
        const picks = await dc.dbGetMflUserPicks(PICKER);
        const catalogue = await dc.dbGetMFLMovies();

        const pick = picks.data!.find((p) => p.film_slug === 'anatomy-of-a-fall')!;
        const film = catalogue.data!.find((f) => f.film_slug === 'anatomy-of-a-fall')!;

        // The two reads group differently; a member's roster total has to agree
        // with the number the films table shows for the same film.
        expect(pick.total_points).toBe(film.total_points);
        expect(typeof pick.total_points).toBe('number');
      });

      it('dbGetMflUserPicks carries the catalogue columns through', async () => {
        const picks = await dc.dbGetMflUserPicks(PICKER);
        const pick = picks.data![0]!;

        expect(pick.title).toBe('Anatomy of a Fall');
        expect(pick.price).toBe(30);
        expect(pick.release_date).toBeNull();
      });

      it('dbAddMflUserPick adds a film and rejects the duplicate', async () => {
        const added = await dc.dbAddMflUserPick(OTHER, 'zulu-dawn');
        expect(added.success).toBe(true);

        const again = await dc.dbAddMflUserPick(OTHER, 'zulu-dawn');
        expect(again.success).toBe(false);
        expect(again.conflict).toBe(true);

        const roster = await dc.dbGetMflUserPicks(OTHER);
        expect(roster.data).toHaveLength(1);

        await dc.dbRemoveMflUserPick(OTHER, 'zulu-dawn');
      });

      it('dbAddMflUserPick reports a film that is not in the catalogue', async () => {
        const result = await dc.dbAddMflUserPick(OTHER, 'not-a-real-film');

        expect(result.success).toBe(false);
        expect(result.notFound).toBe(true);
        expect(result.conflict).toBeUndefined();
      });

      it('dbRemoveMflUserPick will not remove another member\'s pick', async () => {
        const result = await dc.dbRemoveMflUserPick(OTHER, 'anatomy-of-a-fall');

        expect(result.success).toBe(true);
        expect(result.removed).toBe(false);

        // Still on its actual owner's roster.
        const mine = await dc.dbGetMflUserPicks(PICKER);
        expect(mine.data!.map((p) => p.film_slug)).toContain('anatomy-of-a-fall');
      });

      it('dbRemoveMflUserPick removes the caller\'s own pick', async () => {
        await dc.dbAddMflUserPick(OTHER, 'nobody-picked-me');

        const removed = await dc.dbRemoveMflUserPick(OTHER, 'nobody-picked-me');
        expect(removed.removed).toBe(true);

        const roster = await dc.dbGetMflUserPicks(OTHER);
        expect(roster.data).toEqual([]);
      });

      it('dbResolveLbusername returns null for an account with nothing linked', async () => {
        const result = await dc.dbResolveLbusername(
          '00000000-0000-0000-0000-000000000000',
        );

        expect(result.success).toBe(true);
        expect(result.data).toBeNull();
      });

      it('dbGetMFLUserScores returns empty for a user with no picks', async () => {
        const result = await dc.dbGetMFLUserScores(OTHER);

        expect(result.success).toBe(true);
        expect(result.data).toEqual([]);
      });
    });
  });

  describe('Top Rated Films', () => {
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

      const after = await dc.dbGetUserRatings('test_user_minimal');
      expect(after.data).toEqual([]);
    });
  });
});

// Isolated because it adds rows the shared fixture assertions don't expect;
// afterAll restores the standard fixtures.
describe('dbGetFilmDetail — rows the standard fixtures do not cover', () => {
  beforeAll(async () => {
    await db.insert(films).values([
      { filmSlug: 'detail-unwatched', title: 'Unwatched Film', lbRating: 3.3 },
      { filmSlug: 'detail-zero-rated', title: 'Zero Rated Film' },
    ]);
    await db.insert(userFilms).values([
      {
        lbusername: 'test_user_active',
        filmSlug: 'detail-zero-rated',
        title: 'Zero Rated Film',
        rating: 0,
      },
    ]);
  });

  afterAll(async () => {
    await resetDatabase();
  });

  it('treats a 0 rating as watched-but-unrated', async () => {
    const result = await dc.dbGetFilmDetail('detail-zero-rated');

    expect(result.data!.watchedCount).toBe(1);
    expect(result.data!.ratedCount).toBe(0);
    expect(result.data!.averageRating).toBeNull();
    expect(result.data!.ratings).toEqual([]);
  });

  it('picks the most common title when users disagree and no Films row exists', async () => {
    // Deterministic across calls: frequency first, alphabetical tiebreak.
    await db.insert(userFilms).values([
      { lbusername: 'test_user_active', filmSlug: 'detail-untitled', title: 'The Real Title' },
      { lbusername: 'test_user_minimal', filmSlug: 'detail-untitled', title: 'The Real Title' },
      { lbusername: 'test_user_non_discord', filmSlug: 'detail-untitled', title: 'A Typo Title' },
    ]);

    const first = await dc.dbGetFilmDetail('detail-untitled');
    const second = await dc.dbGetFilmDetail('detail-untitled');

    expect(first.data!.title).toBe('The Real Title');
    expect(second.data!.title).toBe(first.data!.title);
  });

  it('returns a catalogued film nobody has watched with zeroed stats', async () => {
    const result = await dc.dbGetFilmDetail('detail-unwatched');

    expect(result.data).toMatchObject({
      title: 'Unwatched Film',
      letterboxdRating: 3.3,
      watchedCount: 0,
      ratedCount: 0,
      averageRating: null,
    });
  });
});

// Isolated because the weighted score depends on the global mean over ALL
// ratings, so this block owns the whole rating population and restores it after.
describe('dbGetTopUserFilms — highest-rated membership gate', () => {
  // c = (2*5 + 6*4.5 + 8*1)/16 = 2.8125, m = 10 → adj(FLUKE) ≈ 3.18 vs
  // adj(SOLID) ≈ 3.45, so SOLID wins despite the lower raw average.
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
