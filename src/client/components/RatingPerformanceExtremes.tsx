import { Link } from "react-router-dom";
import type { RatingDifferentialFilm } from "../../shared/types";
import { cn } from "../lib/utils";

type RatingPerformanceExtremesProps = {
  over: RatingDifferentialFilm[];
  under: RatingDifferentialFilm[];
  loading?: boolean;
};

const formatDiff = (d: number) => `${d >= 0 ? "+" : ""}${d.toFixed(2)}`;

const Group = ({
  title,
  films,
  tone,
  emptyMessage,
}: {
  title: string;
  films: RatingDifferentialFilm[];
  tone: "over" | "under";
  emptyMessage: string;
}) => (
  <div className="flex-1 min-w-0">
    <h3 className="subheading max-md:text-base">{title}</h3>
    {films.length === 0 ? (
      <p className="body-text -prose italic opacity-70">{emptyMessage}</p>
    ) : (
      <ol className="list-none flex flex-col gap-3">
        {films.map((film) => (
          <li key={film.film_slug} className="m-0">
            <Link
              to={`/film/${film.film_slug}`}
              className="group flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-letterboxd-bg-tertiary"
            >
              <div className="min-w-0">
                <span className="block truncate font-bold text-letterboxd-text-primary transition-colors group-hover:text-letterboxd-link-hover">
                  {film.title}
                </span>
                <span className="block text-sm text-letterboxd-text-secondary">
                  Ours {film.average_rating.toFixed(2)} · LB{" "}
                  {film.lb_rating.toFixed(2)}
                </span>
              </div>
              <span
                className={cn(
                  "movie-stats shrink-0 whitespace-nowrap font-bold",
                  tone === "over"
                    ? "text-letterboxd-success"
                    : "text-letterboxd-error",
                )}
              >
                {formatDiff(film.differential)}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    )}
  </div>
);

const RatingPerformanceExtremes = ({
  over,
  under,
  loading = false,
}: RatingPerformanceExtremesProps) => (
  <div
    aria-busy={loading}
    className={cn(
      "flex flex-row justify-between max-md:flex-col gap-x-4 gap-y-6 w-full transition-opacity",
      loading && "opacity-50",
    )}
  >
    <Group
      title="Most overperforming"
      films={over}
      tone="over"
      emptyMessage="No qualifying films yet."
    />
    <Group
      title="Most underperforming"
      films={under}
      tone="under"
      emptyMessage="No qualifying films yet."
    />
  </div>
);

export default RatingPerformanceExtremes;
