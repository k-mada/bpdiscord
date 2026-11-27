import { Request, Response } from "express";
import { dbGetFilmDetail } from "./dataController";
import { filmCardVersion } from "../embeds/filmCard";
import { resolveCardPoster } from "../embeds/posterImage";

export async function getFilmCardImage(
  req: Request,
  res: Response,
): Promise<void> {
  const requestedSlug = req.params.filmSlug ?? "";
  const slug = requestedSlug.toLowerCase();

  try {
    const result = await dbGetFilmDetail(slug);
    if (!result.success) {
      console.error("dbGetFilmDetail failed:", result.error);
      res.status(500).json({ error: "Failed to get film detail" });
      return;
    }
    const film = result.data;
    if (!film) {
      res.status(404).json({ error: `No film found for slug: ${slug}` });
      return;
    }

    // Only the current version renders, so cycling ?v= can't force a fresh
    // render past the CDN on every request.
    const version = filmCardVersion(film);
    if (requestedSlug !== slug || req.query.v !== version) {
      res.set("Cache-Control", "no-store");
      res.redirect(302, `/api/og/film/${slug}.png?v=${version}`);
      return;
    }

    const [{ renderFilmCardPng }, poster] = await Promise.all([
      import("../embeds/renderFilmCard"),
      resolveCardPoster(film.poster),
    ]);
    const png = await renderFilmCardPng(film, poster);

    res.set({
      "Content-Type": "image/png",
      "Cache-Control":
        "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
      // Helmet defaults to same-origin, which blocks browser-side previews.
      "Cross-Origin-Resource-Policy": "cross-origin",
    });
    res.send(png);
  } catch (error) {
    console.error("Error in getFilmCardImage:", error);
    res.status(500).json({ error: "Failed to render film card" });
  }
}
