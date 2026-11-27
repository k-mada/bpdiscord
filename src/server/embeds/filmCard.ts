import type { FilmDetail } from "../../shared/types";
import { EMBED_PALETTE } from "./palette";

// Rendered at 2x: Discord shows the card about 400px wide, so the poster lands
// near 100px. 1.91:1 so X doesn't crop it.
export const CARD_WIDTH = 900;
export const CARD_HEIGHT = 470;
export const POSTER_WIDTH = 220;
export const POSTER_HEIGHT = 330;
const PADDING = 40;
const POSTER_GAP = 48;
const RATED_FONT_SIZE = 24;
const AVERAGE_FONT_SIZE = 32;
const STAR_SIZE = 28;

export const CARD_FONT_FAMILY = "Be Vietnam Pro";

export type FilmCardStats = Pick<
  FilmDetail,
  "ratedCount" | "averageRating" | "letterboxdRating"
>;

export interface CardPoster {
  /** A data URI: satori would otherwise fetch remote URLs itself, unbounded. */
  src: string;
  kind: "poster" | "logo";
}

/** Satori's element shape, written as plain objects so the server needs no React. */
export interface CardNode {
  type: string;
  props: {
    style?: Record<string, string | number>;
    src?: string;
    width?: number;
    height?: number;
    children?: string | CardNode | CardNode[];
  };
}

export function formatAverage(value: number | null): string {
  return value === null ? "—" : value.toFixed(2);
}

/**
 * Changes whenever the rendered numbers do. The image URL carries it, so the
 * CDN never serves a stale card under a fresh page fetch.
 */
export function filmCardVersion(stats: FilmCardStats): string {
  const part = (value: number | null) =>
    value === null ? "na" : value.toFixed(2);
  return `${stats.ratedCount}-${part(stats.averageRating)}-${part(stats.letterboxdRating)}`;
}

const STAR_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${EMBED_PALETTE["letterboxd-pro"]}" d="M12 2l2.94 6.86 7.06.62-5.36 4.68 1.6 6.94L12 17.36 5.76 21.1l1.6-6.94L2 9.48l7.06-.62z"/></svg>`;
const STAR_SRC = `data:image/svg+xml;utf8,${encodeURIComponent(STAR_SVG)}`;

function averageLine(label: string, value: number | null): CardNode {
  const children: CardNode[] = [
    { type: "span", props: { children: `${label}: ${formatAverage(value)}` } },
  ];
  // A star after "—" would suggest a rating that doesn't exist.
  if (value !== null) {
    children.push({
      type: "img",
      props: {
        src: STAR_SRC,
        width: STAR_SIZE,
        height: STAR_SIZE,
        style: { marginLeft: 10 },
      },
    });
  }
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        alignItems: "center",
        fontSize: AVERAGE_FONT_SIZE,
        fontWeight: 600,
        color: EMBED_PALETTE["letterboxd-text-primary"],
      },
      children,
    },
  };
}

function posterSlot(poster: CardPoster): CardNode {
  const image: CardNode =
    poster.kind === "poster"
      ? {
          type: "img",
          props: {
            src: poster.src,
            width: POSTER_WIDTH,
            height: POSTER_HEIGHT,
            style: { objectFit: "cover" },
          },
        }
      : {
          type: "img",
          props: {
            src: poster.src,
            width: POSTER_WIDTH - 40,
            height: POSTER_HEIGHT - 40,
            style: { objectFit: "contain" },
          },
        };
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        borderRadius: 8,
        overflow: "hidden",
        backgroundColor: EMBED_PALETTE["letterboxd-bg-secondary"],
      },
      children: image,
    },
  };
}

export function buildFilmCard(stats: FilmCardStats, poster: CardPoster): CardNode {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        alignItems: "center",
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        padding: `0 ${PADDING}px`,
        backgroundColor: EMBED_PALETTE["letterboxd-bg-primary"],
        fontFamily: CARD_FONT_FAMILY,
      },
      children: [
        posterSlot(poster),
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              marginLeft: POSTER_GAP,
              gap: 10,
            },
            children: [
              {
                type: "div",
                props: {
                  style: {
                    fontSize: RATED_FONT_SIZE,
                    fontWeight: 400,
                    color: EMBED_PALETTE["letterboxd-text-muted"],
                  },
                  children: `${stats.ratedCount} rated`,
                },
              },
              averageLine("Our average", stats.averageRating),
              averageLine("Letterboxd average", stats.letterboxdRating),
            ],
          },
        },
      ],
    },
  };
}
