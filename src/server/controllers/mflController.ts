import { Request, Response } from "express";
import { ApiResponse } from "../../shared/types";
import {
  dbGetMFLScoringMetrics,
  dbGetMFLUserScores,
  dbGetMFLMovies,
  dbGetMflMovieScore,
  dbUpsertMflMovieScore,
  dbDeleteMflMovieScore,
  dbResolveLbusername,
  dbGetMflUserPicks,
  dbAddMflUserPick,
  dbRemoveMflUserPick,
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
 *
 * MFLUserPicks keys on lbusername while the JWT identifies the auth account, so
 * every picks handler starts here. The 409 is not a designed-for path — signup
 * makes lbusername optional, so an account can exist without one, and without
 * this guard the insert would fail NOT NULL and surface as an opaque 500.
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
    res.status(409).json({
      error:
        "Your account has no Letterboxd username linked. Ask an admin to link one before picking films.",
    });
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

  const picks = dbResult.data.map((pick) => ({
    filmSlug: pick.film_slug,
    title: pick.title,
    releaseDate: pick.release_date,
    price: pick.price,
    totalPoints: pick.total_points,
  }));

  const response: ApiResponse = {
    message: "MFL picks retrieved successfully",
    data: {
      picks,
      // Summed here rather than on the client so the roster total and the
      // leaderboard cannot disagree about the same member.
      rosterTotal: picks.reduce((total, pick) => total + pick.totalPoints, 0),
    },
  };
  res.json(response);
}

export async function addMflUserPick(
  req: Request,
  res: Response,
): Promise<void> {
  const { filmSlug } = req.body;
  if (typeof filmSlug !== "string" || filmSlug.trim() === "") {
    res.status(400).json({ error: "filmSlug is required" });
    return;
  }

  const lbusername = await requireLbusername(req, res);
  if (!lbusername) return;

  const dbResult = await dbAddMflUserPick(lbusername, filmSlug);
  if (dbResult.success) {
    res.status(201).json({ message: "Pick added successfully" });
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
  res.status(500).json({ error: dbResult.error || "Failed to add pick" });
}

export async function removeMflUserPick(
  req: Request,
  res: Response,
): Promise<void> {
  const { filmSlug } = req.params;
  if (!filmSlug) {
    res.status(400).json({ error: "filmSlug is required" });
    return;
  }

  const lbusername = await requireLbusername(req, res);
  if (!lbusername) return;

  const dbResult = await dbRemoveMflUserPick(lbusername, filmSlug);
  if (!dbResult.success) {
    res.status(500).json({ error: dbResult.error || "Failed to remove pick" });
    return;
  }
  if (!dbResult.removed) {
    res.status(404).json({ error: "You have not picked that film." });
    return;
  }
  res.json({ message: "Pick removed successfully" });
}
