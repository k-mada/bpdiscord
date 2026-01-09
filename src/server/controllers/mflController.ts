import { Request, Response } from "express";
import { ApiResponse } from "../types";
import {
  dbGetMFLScoringMetrics,
  dbGetMFLUserScores,
  dbGetMFLMovies,
  dbGetMflMovieScore,
  dbUpsertMflMovieScore,
  dbDeleteMflScoringMetric,
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
    }));

    const response: ApiResponse = {
      message: "MFL user scores retrieved successfully",
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

export async function upsertMflMovieScore(
  req: Request,
  res: Response
): Promise<void> {
  const { filmSlug, pointsAwarded, metricId, scoringId } = req.body;
  if (!filmSlug || !pointsAwarded) {
    res
      .status(400)
      .json({ error: "Film slug and points awarded are required" });
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
  } else {
    res
      .status(500)
      .json({ error: dbResult.error || "Failed to upsert MFL movie score" });
  }
}

export async function deleteMflScoringMetric(
  req: Request,
  res: Response
): Promise<void> {
  const { scoringId } = req.params;

  const parsedScoringId = parseInt(scoringId || "");
  if (!scoringId || isNaN(parsedScoringId)) {
    res.status(400).json({ error: "Scoring ID is required" });
    return;
  }

  const dbResult = await dbDeleteMflScoringMetric(parsedScoringId);
  if (dbResult.success) {
    res
      .status(200)
      .json({ message: "MFL scoring metric deleted successfully" });
  } else {
    res
      .status(500)
      .json({ error: dbResult.error || "Failed to delete MFL scoring metric" });
  }
}
