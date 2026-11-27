import { dbGetFilmDetail } from "../controllers/dataController";
import { FILM_SLUG_PATTERN } from "../middleware/validation";
import { CARD_HEIGHT, CARD_WIDTH, filmCardVersion } from "./filmCard";
import { EmbedPage, SITE_TITLE } from "./registry";

export const filmEmbedPage: EmbedPage = {
  path: "/film/:filmSlug",
  async resolve({ filmSlug }, { origin }) {
    const slug = filmSlug?.toLowerCase();
    if (!slug || !FILM_SLUG_PATTERN.test(slug)) return null;

    const result = await dbGetFilmDetail(slug);
    if (!result.success) throw new Error(result.error ?? "dbGetFilmDetail failed");
    const film = result.data;
    if (!film) return null;

    const year = film.releaseYear === null ? "" : ` (${film.releaseYear})`;
    return {
      title: `${SITE_TITLE} - ${film.title}${year}`,
      card: "summary_large_image",
      imageUrl: `${origin}/api/og/film/${slug}.png?v=${filmCardVersion(film)}`,
      imageWidth: CARD_WIDTH,
      imageHeight: CARD_HEIGHT,
    };
  },
};
