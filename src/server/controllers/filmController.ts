import { Request, Response } from "express";
import { dbGetFilmDetail } from "./dataController";

export async function getFilmDetail(
  req: Request,
  res: Response,
): Promise<void> {
  // Letterboxd slugs are lowercase; normalizing keeps /film/Heat and /film/heat
  // from being two URLs where one 404s.
  const filmSlug = req.params.filmSlug?.toLowerCase();

  if (!filmSlug) {
    res.status(400).json({ error: "Film slug is required" });
    return;
  }

  try {
    const result = await dbGetFilmDetail(filmSlug, {
      includeNonDiscord: req.query.includeNonDiscord === "true",
    });

    if (!result.success) {
      console.error("dbGetFilmDetail failed:", result.error);
      res.status(500).json({ error: "Failed to get film detail" });
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

    // Short TTL: a refresh job can change these numbers at any time, so this
    // absorbs bursts without making a user's own new rating feel missing.
    res.set("Cache-Control", "public, max-age=60");
    res.json({
      message: "Film detail retrieved from database",
      data: result.data,
    });
  } catch (error) {
    console.error("Error in getFilmDetail:", error);
    res.status(500).json({ error: "Failed to get film detail" });
  }
}
