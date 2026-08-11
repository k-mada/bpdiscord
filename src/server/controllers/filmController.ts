import { Request, Response } from "express";
import { dbGetFilmDetail } from "./dataController";

export async function getFilmDetail(
  req: Request,
  res: Response,
): Promise<void> {
  const { filmSlug } = req.params;

  if (!filmSlug) {
    res.status(400).json({ error: "Film slug is required" });
    return;
  }

  try {
    const result = await dbGetFilmDetail(filmSlug, {
      includeNonDiscord: req.query.includeNonDiscord === "true",
    });

    if (!result.success) {
      res
        .status(500)
        .json({ error: result.error || "Failed to get film detail" });
      return;
    }

    if (!result.data) {
      res.status(404).json({
        error: `No film found in database for slug: ${filmSlug}`,
        message:
          "Trigger a refresh from /fetcher (or admin refresh-rankings) to populate.",
      });
      return;
    }

    res.json({
      message: "Film detail retrieved from database",
      data: result.data,
    });
  } catch (error) {
    console.error("Error in getFilmDetail:", error);
    res.status(500).json({
      error: `Failed to get film detail: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    });
  }
}
