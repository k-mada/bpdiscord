vi.mock("../controllers/dataController", () => ({
  dbGetFilmDetail: vi.fn(),
}));

import { dbGetFilmDetail } from "../controllers/dataController";
import { filmEmbedPage } from "../embeds/filmEmbed";
import { embedPages } from "../embeds/pages";

const context = { origin: "https://example.test" };

const film = {
  filmSlug: "silence",
  title: "Silence",
  releaseYear: 2016,
  poster: null,
  letterboxdUrl: null,
  letterboxdRating: 3.99,
  watchedCount: 21,
  ratedCount: 17,
  averageRating: 4.15,
  ratings: [],
};

beforeEach(() => {
  vi.mocked(dbGetFilmDetail).mockReset();
  vi.mocked(dbGetFilmDetail).mockResolvedValue({ success: true, data: film });
});

describe("filmEmbedPage", () => {
  it("is registered", () => {
    expect(embedPages).toContain(filmEmbedPage);
  });

  it("builds a large-image card with the title and year, and no site name or description", async () => {
    const meta = await filmEmbedPage.resolve({ filmSlug: "silence" }, context);

    expect(meta).toEqual({
      title: "The Big Picture Discord - Silence (2016)",
      card: "summary_large_image",
      imageUrl: "https://example.test/api/og/film/silence.png?v=17-4.15-3.99",
      imageWidth: 900,
      imageHeight: 470,
    });
  });

  it("leaves the year off when it is unknown", async () => {
    vi.mocked(dbGetFilmDetail).mockResolvedValue({
      success: true,
      data: { ...film, releaseYear: null },
    });

    const meta = await filmEmbedPage.resolve({ filmSlug: "silence" }, context);

    expect(meta?.title).toBe("The Big Picture Discord - Silence");
  });

  it("uses the Discord-scoped numbers and lowercases the slug", async () => {
    const meta = await filmEmbedPage.resolve({ filmSlug: "Silence" }, context);

    expect(dbGetFilmDetail).toHaveBeenCalledWith("silence");
    expect(meta?.imageUrl).toContain("/api/og/film/silence.png");
  });

  it("returns null for an unknown film", async () => {
    vi.mocked(dbGetFilmDetail).mockResolvedValue({ success: true, data: null });

    expect(await filmEmbedPage.resolve({ filmSlug: "nope" }, context)).toBeNull();
  });

  it("returns null for a malformed slug without querying", async () => {
    expect(await filmEmbedPage.resolve({ filmSlug: "a b" }, context)).toBeNull();
    expect(dbGetFilmDetail).not.toHaveBeenCalled();
  });

  it("throws on a DB failure, so the router falls back to the defaults", async () => {
    vi.mocked(dbGetFilmDetail).mockResolvedValue({ success: false, error: "down" });

    await expect(filmEmbedPage.resolve({ filmSlug: "silence" }, context)).rejects.toThrow("down");
  });
});
