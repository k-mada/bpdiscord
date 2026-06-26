import { Request, Response } from "express";
import {
  dbGetTotalRatingsDistribution,
  dbGetAllUserFilms,
  dbGetUserFilmsCount,
  dbGetMissingFilms,
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

export async function getTopWatchedFilms(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await dbGetTopUserFilms({
    orderBy: TopUserFilmsOrder.MostWatched,
    limit: 24,
  });
  res.json(result);
}

export async function getTopFilmsByYear(
  req: Request,
  res: Response,
): Promise<void> {
  const year = req.params.year
    ? Number(req.params.year)
    : new Date().getFullYear();

  if (!Number.isInteger(year) || year < 1870 || year > 2100) {
    res.status(400).json({ success: false, error: "Invalid year" });
    return;
  }

  const [rated, watched] = await Promise.all([
    dbGetTopUserFilms({
      orderBy: TopUserFilmsOrder.HighestRated,
      year,
      minRatings: 5,
      limit: 25,
    }),
    dbGetTopUserFilms({
      orderBy: TopUserFilmsOrder.MostWatched,
      year,
      limit: 25,
    }),
  ]);

  if (!rated.success || !watched.success) {
    res.json({ success: false, error: rated.error ?? watched.error });
    return;
  }

  res.json({
    success: true,
    data: { year, topRated: rated.data, topWatched: watched.data },
  });
}

export async function getMissingFilms(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await dbGetMissingFilms();
  res.json(result);
}

export async function getTopRatedUserFilms(
  req: Request,
  res: Response,
): Promise<void> {
  const result = await dbGetTopUserFilms({
    orderBy: TopUserFilmsOrder.HighestRated,
    minRatings: 20,
  });
  res.json(result);
}
