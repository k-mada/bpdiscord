import { Request, Response } from "express";
import { ApiResponse } from "../../shared/types";
import { NO_LBUSERNAME_MESSAGE } from "../../shared/utilities";
import {
  dbGetMFLScoringMetrics,
  dbGetMFLUserScores,
  dbGetMFLLeaderboard,
  dbGetMFLMovies,
  dbGetMflMovieScore,
  dbUpsertMflMovieScore,
  dbDeleteMflMovieScore,
  dbResolveLbusername,
  dbGetUserRosters,
  dbGetRosterOwner,
  dbGetRosterPicks,
  dbCreateRoster,
  dbUpdateRoster,
  dbDeleteRoster,
} from "./dataController";

export async function getMFLScoringMetrics(
  req: Request,
  res: Response
): Promise<void> {
  const dbResult = await dbGetMFLScoringMetrics();

  if (dbResult.success && dbResult.data) {
    const scoringMetrics = dbResult.data.map((metric) => ({
      metricId: metric.metric_id,
      metric: metric.metric,
      metricName: metric.metric_name,
      category: metric.category,
      scoringCondition: metric.scoring_condition,
      pointValue: metric.point_value,
    }));

    const response: ApiResponse = {
      message: "MFL scoring metrics retrieved successfully",
      data: scoringMetrics,
    };

    res.json(response);
  } else {
    res
      .status(500)
      .json({ error: dbResult.error || "Failed to get MFL scoring metrics" });
  }
}

export async function getMFLUserScores(
  req: Request,
  res: Response
): Promise<void> {
  const { username } = req.params;

  if (!username) {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  const dbResult = await dbGetMFLUserScores(username);
  if (dbResult.success && dbResult.data) {
    const response: ApiResponse = {
      message: "MFL user scores retrieved successfully",
      data: dbResult.data,
    };
    res.json(response);
  } else {
    res
      .status(500)
      .json({ error: dbResult.error || "Failed to get MFL user scores" });
  }
}

export async function getMFLLeaderboard(
  req: Request,
  res: Response
): Promise<void> {
  const dbResult = await dbGetMFLLeaderboard();

  if (dbResult.success && dbResult.data) {
    // Competition rank: rows arrive sorted by total desc, so equal totals reuse
    // the previous rank and the next distinct total jumps to its position.
    let previousTotal: number | null = null;
    let previousRank = 0;
    const leaderboard = dbResult.data.map((row, index) => {
      const rank =
        row.total_points === previousTotal ? previousRank : index + 1;
      previousTotal = row.total_points;
      previousRank = rank;
      return {
        rank,
        rosterId: row.roster_id,
        name: row.name,
        lbusername: row.lbusername,
        displayName: row.display_name,
        totalPoints: row.total_points,
      };
    });

    const response: ApiResponse = {
      message: "MFL leaderboard retrieved successfully",
      data: leaderboard,
    };

    res.json(response);
  } else {
    res
      .status(500)
      .json({ error: dbResult.error || "Failed to get MFL leaderboard" });
  }
}

export async function getMFLMovies(req: Request, res: Response): Promise<void> {
  const dbResult = await dbGetMFLMovies();

  if (dbResult.success && dbResult.data) {
    const mflMovies = dbResult.data.map((movie) => ({
      title: movie.title,
      filmSlug: movie.film_slug,
      releaseDate: movie.release_date,
      price: movie.price,
      totalPoints: movie.total_points,
      pointsByCategory: movie.points_by_category,
    }));

    const response: ApiResponse = {
      message: "MFL movies retrieved successfully",
      data: mflMovies,
    };

    res.json(response);
  } else {
    res
      .status(500)
      .json({ error: dbResult.error || "Failed to get MFL movies" });
  }
}

export async function getMflMovieScore(
  req: Request,
  res: Response
): Promise<void> {
  const { filmSlug } = req.params;

  if (!filmSlug) {
    res.status(400).json({ error: "Film slug is required" });
    return;
  }

  const dbResult = await dbGetMflMovieScore(filmSlug);
  if (dbResult.success && dbResult.data) {
    const mflMovieScore = dbResult.data.map((movie) => ({
      scoringId: movie.scoring_id,
      metricId: movie.metric_id,
      filmSlug: movie.film_slug,
      pointsAwarded: movie.points_awarded,
      metric: movie.metric,
      metricName: movie.metric_name,
      category: movie.category,
      scoringCondition: movie.scoring_condition,
    }));

    const response: ApiResponse = {
      message: "MFL movie scores retrieved successfully",
      data: mflMovieScore,
    };

    res.json(response);
  } else {
    res
      .status(500)
      .json({ error: dbResult.error || "Failed to get MFL movies" });
  }
}

function isPositiveInt(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) > 0;
}

export async function upsertMflMovieScore(
  req: Request,
  res: Response
): Promise<void> {
  const { filmSlug, pointsAwarded, metricId, scoringId } = req.body;

  if (typeof filmSlug !== "string" || filmSlug.trim() === "") {
    res.status(400).json({ error: "Film slug is required" });
    return;
  }
  // Zero is a legitimate award, so this tests the type, not the truthiness.
  if (!Number.isInteger(pointsAwarded)) {
    res.status(400).json({ error: "Points awarded must be an integer" });
    return;
  }
  if (!isPositiveInt(metricId)) {
    res.status(400).json({ error: "Metric id must be a positive integer" });
    return;
  }
  if (scoringId !== undefined && !isPositiveInt(scoringId)) {
    res.status(400).json({ error: "Scoring id must be a positive integer" });
    return;
  }

  const dbResult = await dbUpsertMflMovieScore(
    filmSlug,
    pointsAwarded,
    metricId,
    scoringId
  );
  if (dbResult.success) {
    res.status(200).json({ message: "MFL movie score upserted successfully" });
  } else if (dbResult.conflict) {
    res
      .status(409)
      .json({ error: dbResult.error || "This film already has that award" });
  } else {
    res
      .status(500)
      .json({ error: dbResult.error || "Failed to upsert MFL movie score" });
  }
}

// Deletes an MFLScoringTally row — a movie's award of one metric — not the
// metric itself. validateIntParam has already rejected a non-integer id.
export async function deleteMflMovieScore(
  req: Request,
  res: Response
): Promise<void> {
  const dbResult = await dbDeleteMflMovieScore(Number(req.params.scoringId));
  if (dbResult.success) {
    res.status(200).json({ message: "MFL movie score deleted successfully" });
  } else {
    res
      .status(500)
      .json({ error: dbResult.error || "Failed to delete MFL movie score" });
  }
}

/**
 * The caller's Letterboxd name, or null with the response already sent.
 * Rosters key on lbusername; the JWT only identifies the auth account.
 */
async function requireLbusername(
  req: Request,
  res: Response,
): Promise<string | null> {
  const authUserId = req.user?.id;
  if (!authUserId) {
    res.status(401).json({ error: "Authentication required" });
    return null;
  }

  const result = await dbResolveLbusername(authUserId);
  if (!result.success) {
    res.status(500).json({ error: result.error || "Failed to resolve account" });
    return null;
  }
  if (!result.data) {
    res.status(409).json({ error: NO_LBUSERNAME_MESSAGE });
    return null;
  }

  return result.data;
}

/** Guards data integrity only. Roster size and budget are Vulture's rules. */
const MAX_PICKS = 20;
const MAX_NAME_LENGTH = 80;
/** Per-user roster cap, enforced atomically in dbCreateRoster. */
const MAX_ROSTERS = 10;

/** Validated film slugs, or an error string. Mirrors the DB name-length check. */
function validateFilmSlugs(value: unknown): { filmSlugs: string[] } | { error: string } {
  if (!Array.isArray(value) || value.some((s) => typeof s !== "string")) {
    return { error: "filmSlugs must be an array of strings" };
  }
  if (value.length > MAX_PICKS) {
    return { error: `A roster cannot exceed ${MAX_PICKS} films.` };
  }
  if (new Set(value).size !== value.length) {
    return { error: "A film cannot be picked twice." };
  }
  return { filmSlugs: value as string[] };
}

/** Trimmed roster name, or an error string. */
function validateName(value: unknown): { name: string } | { error: string } {
  if (typeof value !== "string") {
    return { error: "Roster name is required" };
  }
  const name = value.trim();
  if (name === "") {
    return { error: "Roster name is required" };
  }
  if (name.length > MAX_NAME_LENGTH) {
    return { error: `Roster name cannot exceed ${MAX_NAME_LENGTH} characters.` };
  }
  return { name };
}

/**
 * The roster the caller owns, or null with the response already sent. 404 hides
 * whether an unowned id exists at all, so a roster cannot be probed by guessing.
 */
async function requireOwnedRoster(
  req: Request,
  res: Response,
  lbusername: string,
): Promise<number | null> {
  const rosterId = Number(req.params.rosterId);
  const ownerResult = await dbGetRosterOwner(rosterId);
  if (!ownerResult.success) {
    res.status(500).json({ error: ownerResult.error || "Failed to resolve roster" });
    return null;
  }
  if (ownerResult.data !== lbusername) {
    res.status(404).json({ error: "Roster not found" });
    return null;
  }
  return rosterId;
}

export async function listRosters(req: Request, res: Response): Promise<void> {
  const lbusername = await requireLbusername(req, res);
  if (!lbusername) return;

  const dbResult = await dbGetUserRosters(lbusername);
  if (!dbResult.success || !dbResult.data) {
    res.status(500).json({ error: dbResult.error || "Failed to get rosters" });
    return;
  }

  const response: ApiResponse = {
    message: "Rosters retrieved successfully",
    data: dbResult.data.map((r) => ({ rosterId: r.roster_id, name: r.name })),
  };
  res.json(response);
}

export async function getRosterPicks(req: Request, res: Response): Promise<void> {
  const lbusername = await requireLbusername(req, res);
  if (!lbusername) return;

  const rosterId = await requireOwnedRoster(req, res, lbusername);
  if (rosterId === null) return;

  const dbResult = await dbGetRosterPicks(rosterId);
  if (!dbResult.success || !dbResult.data) {
    res.status(500).json({ error: dbResult.error || "Failed to get MFL picks" });
    return;
  }

  const response: ApiResponse = {
    message: "MFL picks retrieved successfully",
    data: dbResult.data.map((pick) => ({
      filmSlug: pick.film_slug,
      title: pick.title,
      releaseDate: pick.release_date,
      price: pick.price,
    })),
  };
  res.json(response);
}

export async function createRoster(req: Request, res: Response): Promise<void> {
  const name = validateName(req.body.name);
  if ("error" in name) {
    res.status(400).json({ error: name.error });
    return;
  }
  const picks = validateFilmSlugs(req.body.filmSlugs ?? []);
  if ("error" in picks) {
    res.status(400).json({ error: picks.error });
    return;
  }

  const lbusername = await requireLbusername(req, res);
  if (!lbusername) return;

  const dbResult = await dbCreateRoster(lbusername, name.name, picks.filmSlugs, MAX_ROSTERS);
  if (dbResult.success) {
    res.status(201).json({ message: "Roster created", data: { rosterId: dbResult.data } });
    return;
  }
  if (dbResult.conflict || dbResult.limitReached) {
    res.status(409).json({ error: dbResult.error });
    return;
  }
  if (dbResult.notFound) {
    res.status(404).json({ error: dbResult.error });
    return;
  }
  res.status(500).json({ error: dbResult.error || "Failed to create roster" });
}

export async function updateRoster(req: Request, res: Response): Promise<void> {
  const changes: { name?: string; filmSlugs?: string[] } = {};

  if (req.body.name !== undefined) {
    const name = validateName(req.body.name);
    if ("error" in name) {
      res.status(400).json({ error: name.error });
      return;
    }
    changes.name = name.name;
  }
  if (req.body.filmSlugs !== undefined) {
    const picks = validateFilmSlugs(req.body.filmSlugs);
    if ("error" in picks) {
      res.status(400).json({ error: picks.error });
      return;
    }
    changes.filmSlugs = picks.filmSlugs;
  }
  if (changes.name === undefined && changes.filmSlugs === undefined) {
    res.status(400).json({ error: "Nothing to update" });
    return;
  }

  const lbusername = await requireLbusername(req, res);
  if (!lbusername) return;

  const rosterId = await requireOwnedRoster(req, res, lbusername);
  if (rosterId === null) return;

  const dbResult = await dbUpdateRoster(rosterId, changes);
  if (dbResult.success) {
    res.json({ message: "Roster saved" });
    return;
  }
  if (dbResult.conflict) {
    res.status(409).json({ error: dbResult.error });
    return;
  }
  if (dbResult.notFound) {
    res.status(404).json({ error: dbResult.error });
    return;
  }
  res.status(500).json({ error: dbResult.error || "Failed to save roster" });
}

export async function deleteRoster(req: Request, res: Response): Promise<void> {
  const lbusername = await requireLbusername(req, res);
  if (!lbusername) return;

  const rosterId = await requireOwnedRoster(req, res, lbusername);
  if (rosterId === null) return;

  const dbResult = await dbDeleteRoster(rosterId);
  if (dbResult.success) {
    res.json({ message: "Roster deleted" });
    return;
  }
  res.status(500).json({ error: dbResult.error || "Failed to delete roster" });
}
