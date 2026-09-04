import { Link } from "react-router-dom";
import type { ColumnDef } from "./types";
import type { MovieInCommon, MFLCatalogueFilm } from "../../types";
import type { SwapFilm } from "../../../shared/types";
import StarRating from "../StarRating";
import { compareNullable, formatReleaseDate } from "../../utilities";

export interface SwapFilmHeaderCtx {
  rater: string;
}

export const swapFilmColumns: ColumnDef<SwapFilm, SwapFilmHeaderCtx>[] = [
  {
    key: "title",
    label: "Title",
    sortKey: "title",
    customSort: (a: SwapFilm, b: SwapFilm) => a.title.localeCompare(b.title),
    renderColumn: (data: SwapFilm) => (
      <a
        href={`https://letterboxd.com/film/${data.film_slug}`}
        target="_blank"
        rel="noreferrer"
      >
        {data.title}
      </a>
    ),
  },
  {
    key: "user_rating",
    label: "Rating",
    sortKey: "user_rating",
    // Ascending, nulls lowest; equal/both-null return 0 so the stable sort keeps
    // the server's title-ASC secondary order (alphabetical ties both directions).
    customSort: (a: SwapFilm, b: SwapFilm) => {
      if (a.user_rating === b.user_rating) return 0;
      if (a.user_rating === null) return -1;
      if (b.user_rating === null) return 1;
      return a.user_rating - b.user_rating;
    },
    renderColumn: (data: SwapFilm) =>
      data.user_rating === null ? (
        <span className="text-letterboxd-text-muted italic">not rated</span>
      ) : (
        <StarRating rating={data.user_rating} />
      ),
  },
];

export interface MoviesInCommonHeaderCtx {
  user1: string;
  user2: string;
}

export const moviesInCommonColumns: ColumnDef<
  MovieInCommon,
  MoviesInCommonHeaderCtx
>[] = [
  {
    key: "title",
    label: "Film title",
    sortKey: "title",
  },
  {
    key: "user1_rating",
    label: "User 1 rating",
    customLabel: (ctx) => ctx?.user1 ?? "User 1 rating",
    sortKey: "user1_rating",
    renderColumn: (data: MovieInCommon) => (
      <StarRating rating={data.user1_rating} />
    ),
  },
  {
    key: "user2_rating",
    label: "User 2 rating",
    customLabel: (ctx) => ctx?.user2 ?? "User 2 rating",
    sortKey: "user2_rating",
    renderColumn: (data: MovieInCommon) => (
      <StarRating rating={data.user2_rating} />
    ),
  },
];

/** Prefix keeps a free-text category from colliding with a static column key. */
export const CATEGORY_KEY_PREFIX = "cat:";

const NOT_AWARDED = (
  <span className="text-letterboxd-text-muted" aria-label="not awarded">
    —
  </span>
);

const points = (film: MFLCatalogueFilm, category: string) =>
  film.pointsByCategory[category];

export function mflFilmColumns(
  categories: string[],
): ColumnDef<MFLCatalogueFilm>[] {
  return [
    {
      key: "title",
      label: "Film",
      sortKey: "title",
      customSort: (a, b) => a.title.localeCompare(b.title),
      renderColumn: (film) => (
        <Link to={`/mfl/film/${film.filmSlug}`}>{film.title}</Link>
      ),
    },
    {
      key: "releaseDate",
      label: "Released",
      sortKey: "releaseDate",
      customSort: (a, b) => compareNullable(a.releaseDate, b.releaseDate),
      renderColumn: (film) =>
        film.releaseDate === null ? NOT_AWARDED : formatReleaseDate(film.releaseDate),
    },
    {
      key: "price",
      label: "Price",
      sortKey: "price",
      customSort: (a, b) => compareNullable(a.price, b.price),
      renderColumn: (film) =>
        film.price === null ? NOT_AWARDED : `$${film.price}`,
    },
    {
      key: "totalPoints",
      label: "Total",
      sortKey: "totalPoints",
      customSort: (a, b) => a.totalPoints - b.totalPoints,
    },
    // DataTable's defaults read item[key]; category points live one level down
    // in pointsByCategory, so both the cell and the comparator are explicit.
    ...categories.map<ColumnDef<MFLCatalogueFilm>>((category) => ({
      key: `${CATEGORY_KEY_PREFIX}${category}`,
      label: category,
      sortKey: `${CATEGORY_KEY_PREFIX}${category}`,
      // An unawarded category sorts level with a zero-point award; only the
      // rendered cell keeps them apart.
      customSort: (a, b) =>
        (points(a, category) ?? 0) - (points(b, category) ?? 0),
      renderColumn: (film) => {
        const awarded = points(film, category);
        return awarded === undefined ? NOT_AWARDED : awarded;
      },
    })),
  ];
}
