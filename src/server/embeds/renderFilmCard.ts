import { readFileSync } from "fs";
import path from "path";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";
import {
  CARD_FONT_FAMILY,
  CARD_HEIGHT,
  CARD_WIDTH,
  CardPoster,
  FilmCardStats,
  buildFilmCard,
} from "./filmCard";

type SatoriFont = Parameters<typeof satori>[1]["fonts"][number];

let fonts: SatoriFont[] | undefined;

function loadFonts(): SatoriFont[] {
  const font = (file: string, weight: 400 | 600): SatoriFont => ({
    name: CARD_FONT_FAMILY,
    data: readFileSync(path.join(__dirname, "../assets/fonts", file)),
    weight,
    style: "normal",
  });
  fonts ??= [
    font("BeVietnamPro-Regular.ttf", 400),
    font("BeVietnamPro-SemiBold.ttf", 600),
  ];
  return fonts;
}

/**
 * Loaded with a dynamic import from the image route only, so the other API
 * routes sharing this function never pay satori's or resvg's init cost.
 */
export async function renderFilmCardPng(
  stats: FilmCardStats,
  poster: CardPoster,
): Promise<Buffer> {
  const svg = await satori(
    buildFilmCard(stats, poster) as unknown as Parameters<typeof satori>[0],
    { width: CARD_WIDTH, height: CARD_HEIGHT, fonts: loadFonts() },
  );
  return new Resvg(svg, { fitTo: { mode: "original" } }).render().asPng();
}
