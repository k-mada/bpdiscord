import { Request, Response } from "express";
import { ApiResponse } from "../../shared/types";
import { NO_LBUSERNAME_MESSAGE } from "../../shared/utilities";
import {
  dbGetMFLScoringMetrics,
  dbGetMFLUserScores,
  dbGetMFLMovies,
  dbGetMflMovieScore,
  dbUpsertMflMovieScore,
  dbDeleteMflMovieScore,
  dbResolveLbusername,
  dbGetMflUserPicks,
  dbReplaceMflUserPicks,
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
 * MFLUserPicks keys on lbusername; the JWT only identifies the auth account.
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

export async function getMflUserPicks(
  req: Request,
  res: Response,
): Promise<void> {
  const lbusername = await requireLbusername(req, res);
  if (!lbusername) return;

  const dbResult = await dbGetMflUserPicks(lbusername);
  if (!dbResult.success || !dbResult.data) {
    res
      .status(500)
      .json({ error: dbResult.error || "Failed to get MFL picks" });
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

/** Guards data integrity only. Roster size and budget are Vulture's rules. */
const MAX_PICKS = 20;

export async function replaceMflUserPicks(
  req: Request,
  res: Response,
): Promise<void> {
  const { filmSlugs } = req.body;

  if (!Array.isArray(filmSlugs) || filmSlugs.some((s) => typeof s !== "string")) {
    res.status(400).json({ error: "filmSlugs must be an array of strings" });
    return;
  }
  if (filmSlugs.length > MAX_PICKS) {
    res.status(400).json({ error: `A roster cannot exceed ${MAX_PICKS} films.` });
    return;
  }
  if (new Set(filmSlugs).size !== filmSlugs.length) {
    res.status(400).json({ error: "A film cannot be picked twice." });
    return;
  }

  const lbusername = await requireLbusername(req, res);
  if (!lbusername) return;

  const dbResult = await dbReplaceMflUserPicks(lbusername, filmSlugs);
  if (dbResult.success) {
    res.json({ message: "Picks saved successfully" });
    return;
  }
  if (dbResult.notFound) {
    res.status(404).json({ error: dbResult.error });
    return;
  }
  res.status(500).json({ error: dbResult.error || "Failed to save picks" });
}
