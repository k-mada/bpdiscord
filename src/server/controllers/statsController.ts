import { Request, Response } from "express";
import { getTotalRatingsDistribution } from "./dataController";

export async function getTotalRatings(
  req: Request,
  res: Response
): Promise<void> {
  const result = await getTotalRatingsDistribution();
  res.json(result);
}
