import { eq, asc, desc, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  userRatings,
  userFilms,
  films,
  filmRatings,
  mflScoringMetrics,
  mflScoringTally,
  mflUserMovies,
} from "../db/schema";
import {
  dbOperation,
  dbQueryWithCount,
  dbMutation,
  dbTransaction,
} from "../db/utils";
import { HaterRankingRow, MissingFilmsRow, toNumber } from "../db/queryTypes";

// ===========================
// User Ratings Management
// ===========================

export async function dbDeleteUserRatings(
  username: string,
): Promise<{ success: boolean; error?: string }> {
  return dbMutation(async () => {
    await db.delete(userRatings).where(eq(userRatings.username, username));
  });
}

export async function dbUpsertUserRatings(
  username: string,
  ratings: Array<{ rating: number; count: number }>,
): Promise<{ success: boolean; error?: string }> {
  if (ratings.length === 0) {
    return { success: true };
  }

  return dbTransaction(async (tx) => {
    const ratingsToUpsert = ratings.map((r) => ({
      username,
      rating: r.rating,
      count: r.count,
      updatedAt: new Date(),
    }));

    // Batch upsert - single query instead of N queries
    await tx
      .insert(userRatings)
      .values(ratingsToUpsert)
      .onConflictDoUpdate({
        target: [userRatings.username, userRatings.rating],
        set: {
          count: sql`excluded.count`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  });
}

export async function dbGetUserRatings(username: string): Promise<{
  success: boolean;
  data?: Array<{ username: string; rating: number; count: number | null }>;
  error?: string;
}> {
  return dbOperation(async () => {
    const result = await db
      .select()
      .from(userRatings)
      .where(eq(userRatings.username, username))
      .orderBy(asc(userRatings.rating));

    return result;
  });
}

// ===========================
// Film Ratings Management (formerly LBFilmRatings)
// ===========================

export async function dbGetLBFilms(): Promise<{
  success: boolean;
  data?: Array<{ title: string | null; film_slug: string }>;
  error?: string;
}> {
  return dbOperation(async () => {
    const result = await db
      .select({
        title: films.title,
        film_slug: films.filmSlug,
      })
      .from(films);

    return result;
  });
}

export async function dbGetLBFilmRatings(filmSlugs: string[]): Promise<{
  success: boolean;
  data?: Array<{
    film_slug: string;
    rating: number;
    rating_count: number | null;
  }>;
  error?: string;
}> {
  // Early return for empty array - inArray with empty array generates invalid SQL
  if (filmSlugs.length === 0) {
    return { success: true, data: [] };
  }

  return dbOperation(async () => {
    const result = await db
      .select({
        film_slug: filmRatings.filmSlug,
        rating: filmRatings.rating,
        rating_count: filmRatings.ratingCount,
      })
      .from(filmRatings)
      .where(inArray(filmRatings.filmSlug, filmSlugs))
      .orderBy(asc(filmRatings.rating));

    return result;
  });
}

export async function dbUpsertLBFilmRatings(
  filmSlug: string,
  ratings: { avgRating: number; count: number }[],
): Promise<{ success: boolean; error?: string }> {
  if (ratings.length === 0) {
    return { success: true };
  }

  return dbTransaction(async (tx) => {
    const ratingsToUpsert = ratings.map((r) => ({
      filmSlug,
      rating: r.avgRating,
      ratingCount: r.count,
      updatedAt: new Date(),
    }));

    // Batch upsert - single query instead of N queries
    await tx
      .insert(filmRatings)
      .values(ratingsToUpsert)
      .onConflictDoUpdate({
        target: [filmRatings.filmSlug, filmRatings.rating],
        set: {
          ratingCount: sql`excluded.rating_count`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  });
}

// ===========================
// Username Listing
// ===========================

export async function dbGetAllUsernames(): Promise<{
  success: boolean;
  data?: Array<{ username: string; displayName?: string }>;
  error?: string;
}> {
  return dbOperation(async () => {
    // Single query with LEFT JOIN to get usernames and display names together
    const result = await db
      .selectDistinct({
        username: userRatings.username,
        displayName: users.displayName,
      })
      .from(userRatings)
      .leftJoin(users, eq(userRatings.username, users.lbusername))
      .orderBy(asc(userRatings.username));

    return result.map((r) => ({
      username: r.username,
      displayName: r.displayName || r.username,
    }));
  });
}

// ===========================
// Film Data Management
// ===========================

export async function dbInsertFilmData(
  filmData: Array<{
    film_slug: string;
    title?: string;
    lb_rating?: number;
    url?: string;
    tmdb_link?: string;
    poster?: string;
    banner?: string;
  }>,
): Promise<{ success: boolean; error?: string }> {
  if (filmData.length === 0) {
    return { success: true };
  }

  return dbMutation(async () => {
    const filmsToInsert = filmData.map((f) => ({
      filmSlug: f.film_slug,
      title: f.title,
      lbRating: f.lb_rating,
      url: f.url,
      tmdbLink: f.tmdb_link,
      poster: f.poster,
      banner: f.banner,
      updatedAt: new Date(),
    }));

    // Upsert - update existing films, insert new ones
    await db
      .insert(films)
      .values(filmsToInsert)
      .onConflictDoUpdate({
        target: films.filmSlug,
        set: {
          title: sql`COALESCE(excluded.title, ${films.title})`,
          lbRating: sql`COALESCE(excluded.lb_rating, ${films.lbRating})`,
          url: sql`COALESCE(excluded.url, ${films.url})`,
          tmdbLink: sql`COALESCE(excluded.tmdb_link, ${films.tmdbLink})`,
          poster: sql`COALESCE(excluded.poster, ${films.poster})`,
          banner: sql`COALESCE(excluded.banner, ${films.banner})`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  });
}

// ===========================
// Hater Rankings
// ===========================

export async function dbGetHaterRankings2(): Promise<{
  success: boolean;
  data?: Array<{
    displayName: string;
    username: string;
    filmsRated: number;
    differential: number;
    adjustedDifferential: number;
  }>;
  error?: string;
}> {
  return dbOperation(async () => {
    // Calls PostgreSQL function: get_hater_rankings()
    // Compares user film ratings to the film's lb_rating from Films table
    const result = await db.execute<HaterRankingRow>(
      sql`SELECT * FROM get_hater_rankings()`,
    );

    return result.map((row) => ({
      username: row.lbusername,
      displayName: row.display_name || row.lbusername,
      filmsRated: toNumber(row.films_rated),
      differential: toNumber(row.differential),
      adjustedDifferential: toNumber(row.normalized),
    }));
  });
}

export async function dbGetHaterRankings(): Promise<{
  success: boolean;
  data?: Array<{
    username: string;
    displayName?: string;
    averageRating: number;
    totalRatings: number;
    ratingDistribution: Array<{ rating: number; count: number }>;
  }>;
  error?: string;
}> {
  return dbOperation(async () => {
    // Single query with LEFT JOIN to get ratings and display names together
    const ratingsWithUsers = await db
      .select({
        username: userRatings.username,
        rating: userRatings.rating,
        count: userRatings.count,
        displayName: users.displayName,
      })
      .from(userRatings)
      .leftJoin(users, eq(userRatings.username, users.lbusername))
      .orderBy(asc(userRatings.username), asc(userRatings.rating));

    if (ratingsWithUsers.length === 0) {
      return [];
    }

    // Calculate per-user statistics (still needed for aggregation)
    const userRatingsMap = new Map<
      string,
      {
        displayName: string;
        totalRating: number;
        totalCount: number;
        distribution: Array<{ rating: number; count: number }>;
      }
    >();

    ratingsWithUsers.forEach((item) => {
      const { username, rating, count, displayName } = item;
      const countVal = count ?? 0;

      if (!userRatingsMap.has(username)) {
        userRatingsMap.set(username, {
          displayName: displayName || username,
          totalRating: 0,
          totalCount: 0,
          distribution: [],
        });
      }

      const userData = userRatingsMap.get(username)!;
      userData.totalRating += rating * countVal;
      userData.totalCount += countVal;
      userData.distribution.push({ rating, count: countVal });
    });

    // Build and sort rankings
    const rankings = Array.from(userRatingsMap.entries())
      .map(([username, data]) => ({
        username,
        displayName: data.displayName,
        averageRating:
          data.totalCount > 0 ? data.totalRating / data.totalCount : 0,
        totalRatings: data.totalCount,
        ratingDistribution: data.distribution,
      }))
      .sort((a, b) => a.averageRating - b.averageRating);

    return rankings;
  });
}

// ===========================
// User Profile Management
// ===========================

export async function dbGetUserProfile(username: string): Promise<{
  success: boolean;
  // data is null when user not found, undefined on error
  data?: {
    username: string;
    displayName: string;
    followers: number;
    following: number;
    numberOfLists: number;
    createdAt?: string;
    updatedAt?: string;
  } | null;
  error?: string;
}> {
  return dbOperation(async () => {
    const result = await db
      .select()
      .from(users)
      .where(eq(users.lbusername, username))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const user = result[0]!;
    const data: {
      username: string;
      displayName: string;
      followers: number;
      following: number;
      numberOfLists: number;
      createdAt?: string;
      updatedAt?: string;
    } = {
      username: user.lbusername,
      displayName: user.displayName || user.lbusername,
      followers: user.followers ?? 0,
      following: user.following ?? 0,
      numberOfLists: user.numberOfLists ?? 0,
    };

    if (user.createdAt) {
      data.createdAt = user.createdAt.toISOString();
    }
    if (user.updatedAt) {
      data.updatedAt = user.updatedAt.toISOString();
    }

    return data;
  });
}

export async function dbUpsertUserProfile(
  username: string,
  profileData: {
    displayName: string;
    followers: number;
    following: number;
    numberOfLists: number;
  },
): Promise<{ success: boolean; error?: string }> {
  return dbMutation(async () => {
    await db
      .insert(users)
      .values({
        lbusername: username,
        displayName: profileData.displayName,
        followers: profileData.followers,
        following: profileData.following,
        numberOfLists: profileData.numberOfLists,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: users.lbusername,
        set: {
          displayName: profileData.displayName,
          followers: profileData.followers,
          following: profileData.following,
          numberOfLists: profileData.numberOfLists,
          updatedAt: new Date(),
        },
      });
  });
}

// ===========================
// Total Ratings Distribution
// ===========================

export async function dbGetTotalRatingsDistribution(): Promise<{
  success: boolean;
  data?: Array<{ rating: number; count: number }>;
  error?: string;
}> {
  return dbOperation(async () => {
    // Matches RPC: get_rating_distribution_all
    // Only counts ratings from users where is_discord = true, excludes 0 ratings
    const result = await db
      .select({
        rating: userFilms.rating,
        count: sql<number>`COUNT(${userFilms.rating})::int`,
      })
      .from(userFilms)
      .innerJoin(users, eq(userFilms.lbusername, users.lbusername))
      .where(sql`${users.isDiscord} = true AND ${userFilms.rating} != 0`)
      .groupBy(userFilms.rating)
      .orderBy(asc(userFilms.rating));

    return result.map((r) => ({
      rating: r.rating ?? 0,
      count: r.count ?? 0,
    }));
  });
}

// ===========================
// User Films Management
// ===========================

export async function dbGetAllUserFilms(): Promise<{
  success: boolean;
  data?: Array<{
    title: string | null;
    film_slug: string;
  }>;
  error?: string;
}> {
  return dbOperation(async () => {
    // Matches RPC: get_all_user_films
    // Returns distinct title/film_slug pairs only
    const result = await db
      .selectDistinct({
        title: userFilms.title,
        film_slug: userFilms.filmSlug,
      })
      .from(userFilms)
      .orderBy(asc(userFilms.title));

    return result;
  });
}

export async function dbGetUserFilms(lbusername: string): Promise<{
  success: boolean;
  data?: Array<{
    film_slug: string;
    title: string | null;
    rating: number | null;
    liked: boolean | null;
    created_at: string | null;
    updated_at: string | null;
  }>;
  error?: string;
}> {
  return dbOperation(async () => {
    const result = await db
      .select({
        film_slug: userFilms.filmSlug,
        title: userFilms.title,
        rating: userFilms.rating,
        liked: userFilms.liked,
        created_at: userFilms.createdAt,
        updated_at: userFilms.updatedAt,
      })
      .from(userFilms)
      .where(eq(userFilms.lbusername, lbusername))
      .orderBy(desc(userFilms.createdAt));

    return result.map((r) => ({
      film_slug: r.film_slug,
      title: r.title,
      rating: r.rating,
      liked: r.liked,
      created_at: r.created_at?.toISOString() ?? null,
      updated_at: r.updated_at?.toISOString() ?? null,
    }));
  });
}

export async function dbGetUserFilmsCount(): Promise<{
  success: boolean;
  data?: number;
  error?: string;
}> {
  return dbOperation(async () => {
    // Counts distinct film titles watched by discord users
    const result = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${userFilms.title})::int`,
      })
      .from(userFilms)
      .innerJoin(users, eq(userFilms.lbusername, users.lbusername))
      .where(eq(users.isDiscord, true));

    return result[0]?.count ?? 0;
  });
}

export async function dbUpsertUserFilms(
  lbusername: string,
  filmsData: Array<{
    film_slug: string;
    title: string;
    rating: number;
    liked?: boolean;
  }>,
): Promise<{ success: boolean; error?: string }> {
  if (filmsData.length === 0) {
    return { success: true };
  }

  return dbTransaction(async (tx) => {
    const filmsToUpsert = filmsData.map((film) => ({
      lbusername,
      filmSlug: film.film_slug,
      title: film.title,
      rating: film.rating,
      liked: film.liked ?? false,
      updatedAt: new Date(),
    }));

    // Batch upsert - single query instead of N queries
    await tx
      .insert(userFilms)
      .values(filmsToUpsert)
      .onConflictDoUpdate({
        target: [userFilms.lbusername, userFilms.filmSlug],
        set: {
          title: sql`excluded.title`,
          rating: sql`excluded.rating`,
          liked: sql`excluded.liked`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  });
}

export async function dbUpsertLBFilms(
  filmsData: Array<{
    film_slug: string;
    rating: number;
    rating_count: number;
  }>,
): Promise<{ success: boolean; error?: string }> {
  if (filmsData.length === 0) {
    return { success: true };
  }

  return dbTransaction(async (tx) => {
    const filmsToUpsert = filmsData.map((film) => ({
      filmSlug: film.film_slug,
      rating: film.rating,
      ratingCount: film.rating_count,
      updatedAt: new Date(),
    }));

    // Batch upsert - single query instead of N queries
    await tx
      .insert(filmRatings)
      .values(filmsToUpsert)
      .onConflictDoUpdate({
        target: [filmRatings.filmSlug, filmRatings.rating],
        set: {
          ratingCount: sql`excluded.rating_count`,
          updatedAt: sql`excluded.updated_at`,
        },
      });
  });
}

export async function dbDeleteUserFilms(
  lbusername: string,
): Promise<{ success: boolean; error?: string }> {
  return dbMutation(async () => {
    await db.delete(userFilms).where(eq(userFilms.lbusername, lbusername));
  });
}

// ===========================
// Movies In Common
// ===========================

export async function dbGetMoviesInCommon(
  user1: string,
  user2: string,
): Promise<{
  success: boolean;
  data?: Array<{
    title: string;
    film_slug: string;
    user1_rating: number;
    user2_rating: number;
  }>;
  count?: number;
  error?: string;
}> {
  return dbQueryWithCount(async () => {
    // Use aliased tables for self-join
    const uf1 = db
      .select({
        filmSlug: userFilms.filmSlug,
        title: userFilms.title,
        rating: userFilms.rating,
      })
      .from(userFilms)
      .where(eq(userFilms.lbusername, user1))
      .as("uf1");

    const uf2 = db
      .select({
        filmSlug: userFilms.filmSlug,
        rating: userFilms.rating,
      })
      .from(userFilms)
      .where(eq(userFilms.lbusername, user2))
      .as("uf2");

    // Single query with JOIN to find common films
    const result = await db
      .select({
        title: uf1.title,
        film_slug: uf1.filmSlug,
        user1_rating: uf1.rating,
        user2_rating: uf2.rating,
      })
      .from(uf1)
      .innerJoin(uf2, eq(uf1.filmSlug, uf2.filmSlug))
      .orderBy(asc(uf1.title));

    return result.map((r) => ({
      title: r.title ?? "",
      film_slug: r.film_slug,
      user1_rating: r.user1_rating ?? 0,
      user2_rating: r.user2_rating ?? 0,
    }));
  });
}

export async function dbGetFilmsByUser(username: string): Promise<{
  success: boolean;
  data?: Array<{
    title: string;
    film_slug: string;
    rating: number;
    liked: boolean;
    created_at: string;
    updated_at: string;
  }>;
  error?: string;
}> {
  return dbOperation(async () => {
    const result = await db
      .select({
        title: userFilms.title,
        filmSlug: userFilms.filmSlug,
        rating: userFilms.rating,
        liked: userFilms.liked,
        createdAt: userFilms.createdAt,
        updatedAt: userFilms.updatedAt,
      })
      .from(userFilms)
      .where(eq(userFilms.lbusername, username))
      .orderBy(asc(userFilms.filmSlug));

    return result.map((r) => ({
      title: r.title ?? "",
      film_slug: r.filmSlug,
      rating: r.rating ?? 0,
      liked: r.liked ?? false,
      created_at: r.createdAt?.toISOString() ?? "",
      updated_at: r.updatedAt?.toISOString() ?? "",
    }));
  });
}

// ===========================
// Movie Swap
// ===========================

export async function dbGetMovieSwap(
  user1: string,
  user2: string,
): Promise<{
  success: boolean;
  data?: Array<{
    title: string;
    film_slug: string;
  }>;
  error?: string;
}> {
  return dbOperation(async () => {
    // Matches RPC: get_movie_swap
    // Movies user1 has seen but user2 hasn't
    // Subquery for user2's films
    const user2FilmsSq = db
      .select({ filmSlug: userFilms.filmSlug })
      .from(userFilms)
      .where(eq(userFilms.lbusername, user2));

    const result = await db
      .selectDistinct({
        film_slug: userFilms.filmSlug,
        title: userFilms.title,
      })
      .from(userFilms)
      .where(
        sql`${userFilms.lbusername} = ${user1} AND ${userFilms.filmSlug} NOT IN (${user2FilmsSq})`,
      )
      .orderBy(asc(userFilms.filmSlug));

    return result.map((r) => ({
      title: r.title ?? "",
      film_slug: r.film_slug,
    }));
  });
}

// ===========================
// Missing Films
// ===========================

export async function dbGetMissingFilms(): Promise<{
  success: boolean;
  data?: Array<string>;
  error?: string;
}> {
  return dbOperation(async () => {
    // Matches RPC: get_missing_films
    // Films in UserFilms that don't exist in Films table
    const result = await db.execute<MissingFilmsRow>(sql`
      SELECT array_agg(DISTINCT uf.film_slug) as film_slugs
      FROM "UserFilms" uf
      WHERE NOT EXISTS (
        SELECT f.film_slug FROM "Films" f
        WHERE f.film_slug = uf.film_slug
      )
    `);

    return result[0]?.film_slugs ?? [];
  });
}

// ===========================
// MFL Scoring
// ===========================

export async function dbGetMFLScoringMetrics(): Promise<{
  success: boolean;
  data?: Array<{
    metric_id: number;
    metric: string;
    metric_name: string;
    category: string;
    scoring_condition: string;
    point_value: number;
  }>;
  error?: string;
}> {
  return dbOperation(async () => {
    const result = await db
      .select({
        metric_id: mflScoringMetrics.metricId,
        metric: mflScoringMetrics.metric,
        metric_name: mflScoringMetrics.metricName,
        category: mflScoringMetrics.category,
        scoring_condition: mflScoringMetrics.scoringCondition,
        point_value: mflScoringMetrics.pointValue,
      })
      .from(mflScoringMetrics);

    return result.map((r) => ({
      metric_id: r.metric_id ?? 0,
      metric: r.metric ?? "",
      metric_name: r.metric_name ?? "",
      category: r.category ?? "",
      scoring_condition: r.scoring_condition ?? "",
      point_value: r.point_value ?? 0,
    }));
  });
}

export async function dbGetMFLUserScores(username: string): Promise<{
  success: boolean;
  data?: Array<{
    username: string;
    metric_id: number;
    points_awarded: number;
    category: string;
  }>;
  error?: string;
}> {
  return dbOperation(async () => {
    const result = await db
      .select({
        metric_id: mflScoringTally.metricId,
        points_awarded: mflScoringTally.pointsAwarded,
        category: mflScoringMetrics.category,
      })
      .from(mflScoringTally)
      .leftJoin(
        mflScoringMetrics,
        eq(mflScoringTally.metricId, mflScoringMetrics.metricId),
      ).where(sql`${mflScoringTally.filmSlug} IN (
        SELECT film_slug FROM "MFLUserMovies" WHERE username = ${username}
      )`);

    return result.map((r) => ({
      username,
      metric_id: r.metric_id ?? 0,
      points_awarded: r.points_awarded ?? 0,
      category: r.category ?? "",
    }));
  });
}

export async function dbGetMflMovieScore(filmSlug: string): Promise<{
  success: boolean;
  data?: Array<{
    scoring_id: number;
    metric_id: number;
    film_slug: string;
    points_awarded: number;
    metric: string;
    metric_name: string;
    category: string;
    scoring_condition: string;
  }>;
  error?: string;
}> {
  return dbOperation(async () => {
    const result = await db
      .select({
        scoring_id: mflScoringTally.scoringId,
        metric_id: mflScoringTally.metricId,
        film_slug: mflScoringTally.filmSlug,
        points_awarded: mflScoringTally.pointsAwarded,
        metric: mflScoringMetrics.metric,
        metric_name: mflScoringMetrics.metricName,
        category: mflScoringMetrics.category,
        scoring_condition: mflScoringMetrics.scoringCondition,
      })
      .from(mflScoringTally)
      .leftJoin(
        mflScoringMetrics,
        eq(mflScoringTally.metricId, mflScoringMetrics.metricId),
      )
      .where(eq(mflScoringTally.filmSlug, filmSlug));

    return result.map((r) => ({
      scoring_id: r.scoring_id ?? 0,
      metric_id: r.metric_id ?? 0,
      film_slug: r.film_slug ?? "",
      points_awarded: r.points_awarded ?? 0,
      metric: r.metric ?? "",
      metric_name: r.metric_name ?? "",
      category: r.category ?? "",
      scoring_condition: r.scoring_condition ?? "",
    }));
  });
}

export async function dbGetMFLMovies(): Promise<{
  success: boolean;
  data?: Array<{
    title: string;
    film_slug: string;
  }>;
  error?: string;
}> {
  return dbOperation(async () => {
    // Matches RPC: get_mfl_movies
    // Uses MFLUserMovies table, not MFLScoringTally
    const result = await db
      .selectDistinct({
        title: mflUserMovies.title,
        film_slug: mflUserMovies.filmSlug,
      })
      .from(mflUserMovies)
      .orderBy(asc(mflUserMovies.title));

    return result.map((r) => ({
      title: r.title ?? "",
      film_slug: r.film_slug ?? "",
    }));
  });
}

export async function dbUpsertMflMovieScore(
  filmSlug: string,
  pointsAwarded: number,
  metricId: number,
  scoringId?: number,
): Promise<{ success: boolean; error?: string }> {
  return dbMutation(async () => {
    if (scoringId) {
      // Update existing
      await db
        .update(mflScoringTally)
        .set({
          filmSlug,
          metricId,
          pointsAwarded,
        })
        .where(eq(mflScoringTally.scoringId, scoringId));
    } else {
      // Insert new - scoringId is auto-generated by bigserial
      await db.insert(mflScoringTally).values({
        filmSlug,
        metricId,
        pointsAwarded,
      });
    }
  });
}

export async function dbDeleteMflScoringMetric(scoringId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  return dbMutation(async () => {
    await db
      .delete(mflScoringTally)
      .where(eq(mflScoringTally.scoringId, scoringId));
  });
}
