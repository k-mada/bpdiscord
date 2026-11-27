import { CARD_HEIGHT, CARD_WIDTH } from "../embeds/filmCard";
import { resolveCardPoster } from "../embeds/posterImage";
import { renderFilmCardPng } from "../embeds/renderFilmCard";

// Header fields, not pixels: a byte snapshot would break on any font or
// library bump without the card actually changing.
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function pngSize(png: Buffer) {
  if (!png.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("renderFilmCardPng output is not a PNG");
  }
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

describe("renderFilmCardPng", () => {
  it("renders a PNG at the card size, small enough for WhatsApp's ~300 KB cap", async () => {
    const logo = await resolveCardPoster(null);

    const png = await renderFilmCardPng(
      { ratedCount: 17, averageRating: 4.15, letterboxdRating: 3.99 },
      logo,
    );

    expect(pngSize(png)).toEqual({ width: CARD_WIDTH, height: CARD_HEIGHT });
    expect(png.length).toBeLessThan(300 * 1024);
  });

  it("renders with both averages missing", async () => {
    const logo = await resolveCardPoster(null);

    const png = await renderFilmCardPng(
      { ratedCount: 0, averageRating: null, letterboxdRating: null },
      logo,
    );

    expect(pngSize(png)).toEqual({ width: CARD_WIDTH, height: CARD_HEIGHT });
  });
});
