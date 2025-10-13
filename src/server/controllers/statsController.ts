import { Request, Response } from "express";
import { dbGetTotalRatingsDistribution } from "./dataController";

export async function getTotalRatings(
  req: Request,
  res: Response
): Promise<void> {
  const result = await dbGetTotalRatingsDistribution();
  res.json(result);
}
