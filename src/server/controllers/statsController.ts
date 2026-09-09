import { Request, Response } from "express";
import {
  dbGetTotalRatingsDistribution,
  dbGetAllUserFilms,
  dbGetUserFilmsCount,
  dbGetMissingFilms,
  dbGetRatingDeviationExtremes,
  dbGetTopUserFilms,
  TopUserFilmsOrder,
} from "./dataController";

export async function getTotalRatings(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await dbGetTotalRatingsDistribution();
  res.json(result);
}

export async function getAllUserFilms(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await dbGetAllUserFilms();
  res.json(result);
}

export async function getUserFilmsCount(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await dbGetUserFilmsCount();
  res.json(result);
}

export async function getTopFilmsByYear(
  req: Request,
  res: Response,
): Promise<void> {
  // All-time (no :year) keeps the historical 20-rating bar; a single release
  // year has far fewer ratings, so year-scoped uses a looser 5-rating bar.
  let year: number | undefined;
  if (req.params.year !== undefined) {
    year = Number(req.params.year);
    if (!Number.isInteger(year) || year < 1870 || year > 2100) {
      res.status(400).json({ success: false, error: "Invalid year" });
      return;
    }
  }

  const yearOpt = year !== undefined ? { year } : {};

  const [rated, watched] = await Promise.all([
    dbGetTopUserFilms({
      orderBy: TopUserFilmsOrder.HighestRated,
      ...yearOpt,
      minRatings: year !== undefined ? 5 : 20,
      limit: 25,
    }),
    dbGetTopUserFilms({
      orderBy: TopUserFilmsOrder.MostWatched,
      ...yearOpt,
      limit: year !== undefined ? 25 : 24,
    }),
  ]);

  if (!rated.success || !watched.success) {
    res.json({ success: false, error: rated.error ?? watched.error });
    return;
  }

  res.json({
    success: true,
    data: {
      year: year ?? null,
      topRated: rated.data,
      topWatched: watched.data,
    },
  });
}

export async function getRatingDeviation(
  req: Request,
  res: Response,
): Promise<void> {
  // 20 all-time / 10 per-year: a raw extremum with no confidence weighting is
  // the most noise-prone thing on the page, so it carries a higher floor than
  // the Bayesian-weighted top-films lists (which use 5 per-year).
  let year: number | undefined;
  if (req.params.year !== undefined) {
    year = Number(req.params.year);
    if (!Number.isInteger(year) || year < 1870 || year > 2100) {
      res.status(400).json({ success: false, error: "Invalid year" });
      return;
    }
  }

  const result = await dbGetRatingDeviationExtremes({
    ...(year !== undefined ? { year } : {}),
    minRatings: year !== undefined ? 10 : 20,
  });

  if (!result.success) {
    res.json({ success: false, error: result.error });
    return;
  }

  res.json({
    success: true,
    data: {
      year: year ?? null,
      over: result.data?.over ?? [],
      under: result.data?.under ?? [],
    },
  });
}

export async function getMissingFilms(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await dbGetMissingFilms();
  res.json(result);
}
