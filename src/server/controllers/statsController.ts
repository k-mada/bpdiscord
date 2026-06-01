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
