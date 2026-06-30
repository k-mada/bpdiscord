import type { ColumnDef } from "./types";
import type { MovieInCommon } from "../../types";
import type { SwapFilm } from "../../../shared/types";
import StarRating from "../StarRating";

export const swapFilmColumns: ColumnDef<SwapFilm>[] = [
  {
    key: "title",
    label: "Title",
    sortKey: "title",
  },
  {
    key: "user_rating",
    label: "Rating",
    sortKey: "user_rating",
    customSort: (a: SwapFilm, b: SwapFilm) => {
      if (a.user_rating !== null && b.user_rating !== null) {
        return a.user_rating > b.user_rating ? -1 : 1;
      } else {
        return 1;
      }
    },
    renderColumn: (data: SwapFilm) => (
      <StarRating rating={data.user_rating || 0} />
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
