import type { ColumnDef } from "./types";
import type { MovieInCommon } from "../../types";
import type { SwapFilm } from "../../../shared/types";
import StarRating from "../StarRating";

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
    customLabel: (ctx) => (ctx?.rater ? `${ctx.rater}'s rating` : "Rating"),
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
