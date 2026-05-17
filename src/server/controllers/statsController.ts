import { Request, Response } from "express";
import {
  dbGetTotalRatingsDistribution,
  dbGetAllUserFilms,
  dbGetUserFilmsCount,
  dbGetMissingFilms,
  dbGetTopWatchedFilms,
  dbGetTopRatedUserFilms,
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
  const result = await dbGetTopWatchedFilms();
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
  const result = await dbGetTopRatedUserFilms();
  res.json(result);
}
