import { Request, Response } from "express";
import {
  dbGetTotalRatingsDistribution,
  dbGetAllUserFilms,
  dbGetUserFilmsCount,
  dbGetMissingFilms,
} from "./dataController";

export async function getTotalRatings(
  req: Request,
  res: Response
): Promise<void> {
  const result = await dbGetTotalRatingsDistribution();
  res.json(result);
}

export async function getAllUserFilms(
  req: Request,
  res: Response
): Promise<void> {
  const result = await dbGetAllUserFilms();
  res.json(result);
}

export async function getUserFilmsCount(
  req: Request,
  res: Response
): Promise<void> {
  const result = await dbGetUserFilmsCount();
  res.json(result);
}

export async function getMissingFilms(
  req: Request,
  res: Response
): Promise<void> {
  const result = await dbGetMissingFilms();
  res.json(result);
}
