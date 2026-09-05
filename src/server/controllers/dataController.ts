import { eq, and, asc, desc, inArray, notInArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  users,
  userRatings,
  userFilms,
  films,
  filmRatings,
  mflScoringMetrics,
  mflScoringTally,
  mflFilms,
  mflUserPicks,
  appUsers,
} from "../db/schema";
import {
  dbOperation,
  dbQueryWithCount,
  dbMutation,
  dbTransaction,
  isUniqueViolation,
  isForeignKeyViolation,
} from "../db/utils";
import {
  HaterRankingRow,
  MissingFilmsRow,
  CompatibilityExtremeRow,
  CompatibilityRow,
  toNumber,
  UNCATEGORISED,
} from "../db/queryTypes";
import { FilmDetail, FilmRater, SwapFilm } from "../../shared/types";

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

// Unrated films carry a NULL rating, so COUNT(*) is the watch total —
// COUNT(rating) would silently give the rated subset.
export async function dbGetUserWatchedCount(username: string): Promise<{
  success: boolean;
  data?: number;
  error?: string;
}> {
  return dbOperation(async () => {
    const [row] = await db
      .select({ watched: sql<number>`COUNT(*)::int` })
      .from(userFilms)
      .where(eq(userFilms.lbusername, username));

    return row?.watched ?? 0;
  });
}

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

export async function dbGetAllUsernames(): Promise<{
  success: boolean;
  data?: Array<{ username: string; displayName?: string }>;
  error?: string;
}> {
  return dbOperation(async () => {
    const result = await db
      .selectDistinct({
        username: users.lbusername,
        displayName: users.displayName,
      })
      .from(users)
      .orderBy(asc(users.lbusername));

    return result.map((r) => ({
      username: r.username,
      displayName: r.displayName || r.username,
    }));
  });
}

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
    // Counts distinct films watched by discord users
    const result = await db
      .select({
        count: sql<number>`COUNT(DISTINCT ${userFilms.filmSlug})::int`,
      })
      .from(userFilms)
      .innerJoin(users, eq(userFilms.lbusername, users.lbusername))
      .where(eq(users.isDiscord, true));

    return result[0]?.count ?? 0;
  });
}

export async function dbGetTopWatchedFilms(): Promise<{
  success: boolean;
  data?: Array<{
    count: number;
    rating_count: number;
    watch_count: number;
    average_rating: number;
    film_slug: string;
    title: string | null;
    poster: string | null;
    banner: string | null;
    tmdb_link: string | null;
    url: string | null;
  }>;
  error?: string;
}> {
  return dbOperation(async () => {
    const ratingCount = sql<number>`COUNT(${userFilms.rating})::int`;
    const averageRating = sql`ROUND(AVG(${userFilms.rating})::numeric, 2)`;

    const result = await db
      .select({
        // Per-film row count in UserFilms (watch/list entries). COUNT(DISTINCT film_slug)
        // would always be 1 here because we group by film_slug.
        watch_count: sql<number>`count(*)::int`,
        rating_count: ratingCount,
        film_slug: userFilms.filmSlug,
        average_rating: sql<string>`${averageRating}`,
        title: films.title,
        poster: films.poster,
        banner: films.banner,
        tmdb_link: films.tmdbLink,
        url: films.url,
      })
      .from(userFilms)
      .innerJoin(films, eq(userFilms.filmSlug, films.filmSlug))
      .groupBy(
        userFilms.filmSlug,
        films.title,
        films.poster,
        films.banner,
        films.tmdbLink,
        films.url,
      )
      .orderBy(desc(sql<number>`count(*)::int`), asc(films.title))
      .limit(24);

    return result.map((r) => ({
      average_rating: toNumber(r.average_rating),
      banner: r.banner,
      count: r.watch_count, // deprecate
      film_slug: r.film_slug,
      watch_count: r.watch_count,
      poster: r.poster,
      rating_count: r.rating_count,
      title: r.title,
      tmdb_link: r.tmdb_link,
      url: r.url,
    }));
  });
}

export async function dbGetTopRatedUserFilms(
  options: { limit?: number; minRatings?: number } = {},
): Promise<{
  success: boolean;
  data?: Array<{
    film_slug: string;
    title: string;
    rating_count: number;
    average_rating: number;
    poster: string;
    banner: string;
    tmdb_link: string;
    url: string;
    users: string;
  }>;
  error?: string;
}> {
  const limit = options.limit ?? 25;
  const minRatings = options.minRatings ?? 20;

  return dbOperation(async () => {
    const ratingCount = sql`COUNT(${userFilms.rating})`;
    const averageRating = sql`ROUND(AVG(${userFilms.rating})::numeric, 2)`;

    const result = await db
      .select({
        film_slug: userFilms.filmSlug,
        title: sql<string | null>`MAX(${userFilms.title})`,
        rating_count: sql<number>`${ratingCount}::int`,
        average_rating: sql<string>`${averageRating}`,
        poster: films.poster,
        banner: films.banner,
        tmdb_link: films.tmdbLink,
        url: films.url,
        users: sql<string>`STRING_AGG(DISTINCT ${userFilms.lbusername}, ', ')`,
      })
      .from(userFilms)
      .innerJoin(users, eq(userFilms.lbusername, users.lbusername))
      .innerJoin(films, eq(userFilms.filmSlug, films.filmSlug))
      .where(eq(users.isDiscord, true))
      .groupBy(
        userFilms.filmSlug,
        films.poster,
        films.banner,
        films.tmdbLink,
        films.url,
      )
      .having(sql`${ratingCount} >= ${minRatings}`)
      .orderBy(desc(averageRating), desc(ratingCount), asc(userFilms.filmSlug))
      .limit(limit);

    return result.map((r) => ({
      film_slug: r.film_slug,
      title: r.title ?? "",
      rating_count: r.rating_count,
      average_rating: toNumber(r.average_rating),
      poster: r.poster ?? "",
      banner: r.banner ?? "",
      tmdb_link: r.tmdb_link ?? "",
      url: r.url ?? "",
      users: r.users ?? "",
    }));
  });
}

export enum TopUserFilmsOrder {
  HighestRated = "highest_rated",
  MostWatched = "most_watched",
}

export async function dbGetTopUserFilms(
  options: {
    orderBy?: TopUserFilmsOrder;
    limit?: number;
    minRatings?: number;
    year?: number;
    m?: number;
  } = {},
): Promise<{
  success: boolean;
  data?: Array<{
    film_slug: string;
    title: string;
    watch_count: number;
    rating_count: number;
    average_rating: number;
    poster: string;
    banner: string;
    tmdb_link: string;
    url: string;
  }>;
  error?: string;
}> {
  const orderBy = options.orderBy ?? TopUserFilmsOrder.MostWatched;
  const limit = options.limit ?? 25;
  const minRatings = options.minRatings ?? 0;
  const year = options.year;
  const m = options.m ?? 10;
  const isHighestRated = orderBy === TopUserFilmsOrder.HighestRated;

  return dbOperation(async () => {
    const watchCount = sql<number>`COUNT(*)::int`;
    const ratingCount = sql<number>`COUNT(${userFilms.rating})::int`;
    const averageRating = sql`ROUND(AVG(${userFilms.rating})::numeric, 2)`;

    // Bayesian weighting toward global mean `c` decides membership only, so a
    // 4.9-from-5 can't crowd out a 4.3-from-40. Display re-sorts by raw avg.
    let c = 0;
    if (isHighestRated) {
      const meanRow = await db
        .select({ c: sql<string>`COALESCE(AVG(${userFilms.rating}), 0)` })
        .from(userFilms)
        .innerJoin(users, eq(userFilms.lbusername, users.lbusername))
        .where(eq(users.isDiscord, true));
      c = toNumber(meanRow[0]?.c ?? "0");
    }
    const adjusted = sql`
      (${ratingCount}::numeric / (${ratingCount} + ${m})) * AVG(${userFilms.rating})
      + (${m}::numeric / (${ratingCount} + ${m})) * ${c}
    `;

    const orderClause = isHighestRated
      ? [desc(adjusted), desc(ratingCount), asc(userFilms.filmSlug)]
      : [desc(watchCount), asc(films.title)];

    const base = db
      .select({
        film_slug: userFilms.filmSlug,
        title: films.title,
        watch_count: watchCount,
        rating_count: ratingCount,
        average_rating: sql<string>`${averageRating}`,
        poster: films.poster,
        banner: films.banner,
        tmdb_link: films.tmdbLink,
        url: films.url,
      })
      .from(userFilms)
      .innerJoin(users, eq(userFilms.lbusername, users.lbusername))
      .innerJoin(films, eq(userFilms.filmSlug, films.filmSlug))
      .where(
        and(
          eq(users.isDiscord, true),
          year !== undefined ? eq(films.releaseYear, year) : undefined,
        ),
      )
      .groupBy(
        userFilms.filmSlug,
        films.title,
        films.poster,
        films.banner,
        films.tmdbLink,
        films.url,
      );

    const filtered =
      minRatings > 0
        ? base.having(sql`${ratingCount} >= ${minRatings}`)
        : base;

    const result = await filtered.orderBy(...orderClause).limit(limit);

    const mapped = result.map((r) => ({
      film_slug: r.film_slug,
      title: r.title ?? "",
      watch_count: r.watch_count,
      rating_count: r.rating_count,
      average_rating: toNumber(r.average_rating),
      poster: r.poster ?? "",
      banner: r.banner ?? "",
      tmdb_link: r.tmdb_link ?? "",
      url: r.url ?? "",
    }));

    // Membership was already fixed by the weighted-score LIMIT; this reorders
    // ≤limit rows so the ★ column reads top-to-bottom.
    if (isHighestRated) {
      mapped.sort(
        (a, b) =>
          b.average_rating - a.average_rating ||
          b.rating_count - a.rating_count ||
          a.film_slug.localeCompare(b.film_slug),
      );
    }

    return mapped;
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
    poster: string | null;
    year: number | null;
    letterboxd_url: string | null;
    total_ratings: number;
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

    // LEFT JOIN because the worker may not have backfilled a slug's Films row
    // yet. total_ratings breaks client-side ties toward less-rated films.
    const result = await db
      .select({
        title: uf1.title,
        film_slug: uf1.filmSlug,
        user1_rating: uf1.rating,
        user2_rating: uf2.rating,
        poster: films.poster,
        year: films.releaseYear,
        letterboxd_url: films.url,
        total_ratings: sql<number>`(
          SELECT COUNT(*)::int FROM "UserFilms" uf
          WHERE uf.film_slug = ${uf1.filmSlug}
            AND uf.rating IS NOT NULL AND uf.rating > 0
        )`,
      })
      .from(uf1)
      .innerJoin(uf2, eq(uf1.filmSlug, uf2.filmSlug))
      .leftJoin(films, eq(uf1.filmSlug, films.filmSlug))
      .orderBy(asc(uf1.title));

    return result.map((r) => ({
      title: r.title ?? "",
      film_slug: r.film_slug,
      user1_rating: r.user1_rating ?? 0,
      user2_rating: r.user2_rating ?? 0,
      poster: r.poster ?? null,
      year: r.year ?? null,
      letterboxd_url: r.letterboxd_url ?? null,
      total_ratings: r.total_ratings ?? 0,
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

// Only reached for slugs with no Films row, where users may disagree on the
// title; picking by frequency (alphabetical tiebreak) keeps it stable per call.
function mostCommonTitle(rows: Array<{ title: string | null }>): string | null {
  const counts = new Map<string, number>();
  for (const { title } of rows) {
    if (title) counts.set(title, (counts.get(title) ?? 0) + 1);
  }

  return (
    [...counts.entries()].sort(
      (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
    )[0]?.[0] ?? null
  );
}

export async function dbGetFilmDetail(
  filmSlug: string,
  options: { includeNonDiscord?: boolean } = {},
): Promise<{
  success: boolean;
  data?: FilmDetail | null;
  error?: string;
}> {
  const includeNonDiscord = options.includeNonDiscord ?? false;

  return dbOperation(async () => {
    // Fetched unscoped and filtered below so existence stays independent of the
    // is_discord toggle; LEFT JOIN keeps rows whose user is missing from Users.
    const [filmRows, watchRows] = await Promise.all([
      db
        .select({
          filmSlug: films.filmSlug,
          title: films.title,
          releaseYear: films.releaseYear,
          poster: films.poster,
          url: films.url,
          lbRating: films.lbRating,
        })
        .from(films)
        .where(eq(films.filmSlug, filmSlug))
        .limit(1),
      db
        .select({
          username: userFilms.lbusername,
          displayName: users.displayName,
          rating: userFilms.rating,
          liked: userFilms.liked,
          title: userFilms.title,
          isDiscord: users.isDiscord,
        })
        .from(userFilms)
        .leftJoin(users, eq(userFilms.lbusername, users.lbusername))
        .where(eq(userFilms.filmSlug, filmSlug)),
    ]);

    const film = filmRows[0];
    if (!film && watchRows.length === 0) return null;

    const scoped = includeNonDiscord
      ? watchRows
      : watchRows.filter((r) => r.isDiscord === true);

    // 0 is written for unrated entries alongside NULL, so both are excluded.
    const rated = scoped.filter((r) => r.rating !== null && r.rating > 0);
    const sum = rated.reduce((acc, r) => acc + (r.rating ?? 0), 0);

    const ratings: FilmRater[] = rated
      .map((r) => ({
        username: r.username,
        displayName: r.displayName ?? null,
        rating: r.rating as number,
        liked: r.liked ?? false,
      }))
      .sort(
        (a, b) =>
          b.rating - a.rating ||
          (a.displayName || a.username).localeCompare(
            b.displayName || b.username,
            undefined,
            { sensitivity: "base" },
          ),
      );

    return {
      filmSlug,
      title: film?.title ?? mostCommonTitle(watchRows) ?? filmSlug,
      releaseYear: film?.releaseYear ?? null,
      poster: film?.poster ?? null,
      letterboxdUrl: film?.url ?? null,
      letterboxdRating: film?.lbRating ?? null,
      watchedCount: scoped.length,
      ratedCount: rated.length,
      averageRating: rated.length
        ? Math.round((sum / rated.length) * 100) / 100
        : null,
      ratings,
    };
  });
}

export async function dbGetMovieSwap(
  userA: string,
  userB: string,
): Promise<{
  success: boolean;
  data?: {
    recsForUserA: SwapFilm[];
    recsForUserB: SwapFilm[];
  };
  error?: string;
}> {
  return dbOperation(async () => {
    const swapDirection = async (
      seer: string,
      other: string,
    ): Promise<SwapFilm[]> => {
      const otherFilms = db
        .select({ filmSlug: userFilms.filmSlug })
        .from(userFilms)
        .where(eq(userFilms.lbusername, other));

      const rows = await db
        .select({
          film_slug: userFilms.filmSlug,
          title: userFilms.title,
          user_rating: userFilms.rating,
        })
        .from(userFilms)
        .where(
          and(
            eq(userFilms.lbusername, seer),
            notInArray(userFilms.filmSlug, otherFilms),
          ),
        )
        .orderBy(
          // Drizzle desc() emits NULLS FIRST in Postgres; unrated films sort last.
          sql`${userFilms.rating} DESC NULLS LAST, ${userFilms.title} ASC, ${userFilms.filmSlug} ASC`,
        );

      return rows.map((r) => ({
        film_slug: r.film_slug,
        title: r.title ?? "",
        user_rating: r.user_rating ?? null,
      }));
    };

    const [recsForUserA, recsForUserB] = await Promise.all([
      swapDirection(userB, userA), // films userB has, userA lacks → for userA
      swapDirection(userA, userB), // films userA has, userB lacks → for userB
    ]);

    return { recsForUserA, recsForUserB };
  });
}

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

export interface CompatibilityExtreme {
  username: string;
  displayName: string | null;
  pearson: number;
  sampleSize: number;
  mad: number;
}

export async function dbGetCompatibilityExtremes(username: string): Promise<{
  success: boolean;
  data?: {
    mostCompatible: CompatibilityExtreme[];
    leastCompatible: CompatibilityExtreme[];
  };
  error?: string;
}> {
  return dbOperation(async () => {
    const rows = await db.execute<CompatibilityExtremeRow>(sql`
      SELECT bucket, username, display_name, pearson, sample_size, mad
      FROM taste_compatibility_extremes(${username})
    `);

    const toRow = (r: CompatibilityExtremeRow): CompatibilityExtreme => ({
      username: r.username,
      displayName: r.display_name,
      pearson: r.pearson,
      sampleSize: r.sample_size,
      mad: r.mad,
    });

    return {
      mostCompatible: rows
        .filter((r) => r.bucket === "most_compatible")
        .map(toRow),
      leastCompatible: rows
        .filter((r) => r.bucket === "least_compatible")
        .map(toRow),
    };
  });
}

export interface TasteCompatibility {
  pearson: number | null;
  mad: number | null;
  sampleSize: number;
}

export async function dbGetTasteCompatibility(
  user1: string,
  user2: string,
): Promise<{
  success: boolean;
  data?: TasteCompatibility;
  error?: string;
}> {
  return dbOperation(async () => {
    const rows = await db.execute<CompatibilityRow>(sql`
      SELECT pearson, mad, sample_size
      FROM taste_compatibility(${user1}, ${user2})
    `);

    const row = rows[0];
    return {
      pearson: row?.pearson ?? null,
      mad: row?.mad ?? null,
      sampleSize: row?.sample_size ?? 0,
    };
  });
}

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
      category: r.category ?? UNCATEGORISED,
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
    // Joined, not an IN-subquery on a string table name, so a later rename is a
    // compile error. The picks PK stops the join duplicating a tally row.
    const result = await db
      .select({
        metric_id: mflScoringTally.metricId,
        points_awarded: mflScoringTally.pointsAwarded,
        category: mflScoringMetrics.category,
      })
      .from(mflScoringTally)
      .innerJoin(
        mflUserPicks,
        and(
          eq(mflUserPicks.filmSlug, mflScoringTally.filmSlug),
          eq(mflUserPicks.lbusername, username),
        ),
      )
      .leftJoin(
        mflScoringMetrics,
        eq(mflScoringTally.metricId, mflScoringMetrics.metricId),
      );

    return result.map((r) => ({
      username,
      metric_id: r.metric_id ?? 0,
      points_awarded: r.points_awarded ?? 0,
      category: r.category ?? UNCATEGORISED,
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
      category: r.category ?? UNCATEGORISED,
      scoring_condition: r.scoring_condition ?? "",
    }));
  });
}

export async function dbGetMFLMovies(): Promise<{
  success: boolean;
  data?: Array<{
    title: string;
    film_slug: string;
    release_date: string | null;
    price: number | null;
    total_points: number;
    points_by_category: Record<string, number>;
  }>;
  error?: string;
}> {
  return dbOperation(async () => {
    // Both joins are LEFT so an unscored film still appears: the catalogue is
    // every eligible film, not every scored one. The second one has to be LEFT
    // because the first one is — an unscored film carries a null metric_id, and
    // an inner join would drop the row the first LEFT exists to keep.
    const rows = await db
      .select({
        film_slug: mflFilms.filmSlug,
        title: mflFilms.title,
        release_date: mflFilms.releaseDate,
        price: mflFilms.price,
        category: mflScoringMetrics.category,
        // ::int per the house convention — SUM widens bigint to numeric and
        // COUNT is bigint, both of which postgres.js returns as strings.
        points: sql<number>`SUM(COALESCE(${mflScoringTally.pointsAwarded}, 0))::int`,
        // 0 exactly when the tally join found nothing, which is the only thing
        // separating an unscored film from a genuinely uncategorised award:
        // both group under category NULL.
        awards: sql<number>`COUNT(${mflScoringTally.scoringId})::int`,
      })
      .from(mflFilms)
      .leftJoin(mflScoringTally, eq(mflScoringTally.filmSlug, mflFilms.filmSlug))
      .leftJoin(
        mflScoringMetrics,
        eq(mflScoringMetrics.metricId, mflScoringTally.metricId),
      )
      .groupBy(
        mflFilms.filmSlug,
        mflFilms.title,
        mflFilms.releaseDate,
        mflFilms.price,
        mflScoringMetrics.category,
      )
      .orderBy(asc(mflFilms.title), asc(mflFilms.filmSlug));

    const byFilm = new Map<
      string,
      {
        title: string;
        film_slug: string;
        release_date: string | null;
        price: number | null;
        total_points: number;
        points_by_category: Record<string, number>;
      }
    >();

    for (const row of rows) {
      let film = byFilm.get(row.film_slug);
      if (!film) {
        film = {
          title: row.title,
          film_slug: row.film_slug,
          release_date: row.release_date,
          price: row.price,
          total_points: 0,
          points_by_category: {},
        };
        byFilm.set(row.film_slug, film);
      }

      film.total_points += row.points;
      if (row.awards > 0) {
        const bucket = row.category ?? UNCATEGORISED;
        film.points_by_category[bucket] =
          (film.points_by_category[bucket] ?? 0) + row.points;
      }
    }

    return [...byFilm.values()];
  });
}

const MFL_TALLY_FILM_METRIC_CONSTRAINT = "mfl_scoring_tally_film_metric_key";

export async function dbUpsertMflMovieScore(
  filmSlug: string,
  pointsAwarded: number,
  metricId: number,
  scoringId?: number,
): Promise<{ success: boolean; error?: string; conflict?: boolean }> {
  try {
    if (scoringId !== undefined) {
      await db
        .update(mflScoringTally)
        .set({
          filmSlug,
          metricId,
          pointsAwarded,
        })
        .where(eq(mflScoringTally.scoringId, scoringId));
    } else {
      // scoringId is auto-generated by bigserial
      await db.insert(mflScoringTally).values({
        filmSlug,
        metricId,
        pointsAwarded,
      });
    }
    return { success: true };
  } catch (error) {
    if (isUniqueViolation(error, MFL_TALLY_FILM_METRIC_CONSTRAINT)) {
      return {
        success: false,
        conflict: true,
        error: `Film ${filmSlug} already has an award for metric ${metricId}.`,
      };
    }
    console.error("Database operation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}

export async function dbDeleteMflMovieScore(scoringId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  return dbMutation(async () => {
    await db
      .delete(mflScoringTally)
      .where(eq(mflScoringTally.scoringId, scoringId));
  });
}

const MFL_PICKS_PK = "mfl_user_picks_pkey";
const MFL_PICKS_FILM_FK = "mfl_user_picks_film_slug_fkey";

/** The account's Letterboxd name, what MFLUserPicks keys on. Null when unlinked. */
export async function dbResolveLbusername(authUserId: string): Promise<{
  success: boolean;
  data?: string | null;
  error?: string;
}> {
  return dbOperation(async () => {
    const rows = await db
      .select({ lbusername: appUsers.lbusername })
      .from(appUsers)
      .where(eq(appUsers.id, authUserId))
      .limit(1);

    return rows[0]?.lbusername ?? null;
  });
}

export async function dbGetMflUserPicks(lbusername: string): Promise<{
  success: boolean;
  data?: Array<{
    film_slug: string;
    title: string;
    release_date: string | null;
    price: number | null;
    total_points: number;
  }>;
  error?: string;
}> {
  return dbOperation(async () => {
    // Per-film total, not the catalogue's category split. ::int because SUM
    // widens bigint to numeric, which postgres.js hands back as a string.
    return db
      .select({
        film_slug: mflUserPicks.filmSlug,
        title: mflFilms.title,
        release_date: mflFilms.releaseDate,
        price: mflFilms.price,
        total_points: sql<number>`SUM(COALESCE(${mflScoringTally.pointsAwarded}, 0))::int`,
      })
      .from(mflUserPicks)
      .innerJoin(mflFilms, eq(mflFilms.filmSlug, mflUserPicks.filmSlug))
      .leftJoin(
        mflScoringTally,
        eq(mflScoringTally.filmSlug, mflUserPicks.filmSlug),
      )
      .where(eq(mflUserPicks.lbusername, lbusername))
      .groupBy(
        mflUserPicks.filmSlug,
        mflFilms.title,
        mflFilms.releaseDate,
        mflFilms.price,
      )
      .orderBy(asc(mflFilms.title), asc(mflUserPicks.filmSlug));
  });
}

export async function dbAddMflUserPick(
  lbusername: string,
  filmSlug: string,
): Promise<{
  success: boolean;
  error?: string;
  conflict?: boolean;
  notFound?: boolean;
}> {
  try {
    await db.insert(mflUserPicks).values({ lbusername, filmSlug });
    return { success: true };
  } catch (error) {
    if (isUniqueViolation(error, MFL_PICKS_PK)) {
      return {
        success: false,
        conflict: true,
        error: `You have already picked ${filmSlug}.`,
      };
    }
    if (isForeignKeyViolation(error, MFL_PICKS_FILM_FK)) {
      return {
        success: false,
        notFound: true,
        error: `${filmSlug} is not in the film catalogue.`,
      };
    }
    console.error("Database operation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}

/** Scoped by lbusername, so guessing another member's slug removes nothing. */
export async function dbRemoveMflUserPick(
  lbusername: string,
  filmSlug: string,
): Promise<{ success: boolean; removed?: boolean; error?: string }> {
  try {
    const rows = await db
      .delete(mflUserPicks)
      .where(
        and(
          eq(mflUserPicks.lbusername, lbusername),
          eq(mflUserPicks.filmSlug, filmSlug),
        ),
      )
      .returning({ filmSlug: mflUserPicks.filmSlug });

    return { success: true, removed: rows.length > 0 };
  } catch (error) {
    console.error("Database operation error:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown database error",
    };
  }
}
