import { type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { LBFilm } from "../types";
import { cn } from "../lib/utils";

type Size = "sm" | "md" | "lg";

type MovieBarChartProps = {
  movies: LBFilm[];
  showRating?: boolean;
  showCount?: boolean;
  animated?: boolean;
  emptyMessage?: string;
  size?: Size;
  floorPct?: number;
};

const MovieBarChart = ({
  movies,
  showRating = false,
  showCount = false,
  animated = true,
  emptyMessage = "No films to show.",
  floorPct = 50,
}: MovieBarChartProps) => {
  if (movies.length === 0) {
    return <p className="body-text -prose italic opacity-70">{emptyMessage}</p>;
  }

  const metricOf = (movie: LBFilm) =>
    showRating ? movie.average_rating : showCount ? movie.watch_count : 0;

  const valueOf = (movie: LBFilm): string | null =>
    showRating
      ? movie.average_rating.toFixed(2)
      : showCount
        ? movie.watch_count.toLocaleString()
        : null;

  const metrics = movies.map(metricOf);
  const max = Math.max(...metrics);
  const min = Math.min(...metrics);
  const range = max - min;

  const widthPct = (value: number) => {
    if (!showRating && !showCount) return 100;
    if (range === 0 || max <= 0) return floorPct;
    return floorPct + ((value - min) / range) * (100 - floorPct);
  };

  return (
    <ol className="list-none flex flex-col gap-3">
      {movies.map((movie, index) => {
        const value = valueOf(movie);
        const barStyle = {
          "--bar-w": `${widthPct(metricOf(movie))}%`,
          width: "var(--bar-w)",
          animationDelay: animated ? `${index * 0.06 + 0.1}s` : undefined,
        } as CSSProperties & Record<"--bar-w", string>;

        return (
          <li key={movie.film_slug} className="m-0">
            <Link
              to={`/film/${movie.film_slug}`}
              className="group flex items-center gap-3"
            >
              {movie.poster ? (
                <img
                  src={movie.poster}
                  alt={`${movie.title} poster`}
                  width={48}
                  height={72}
                  loading="lazy"
                  className="h-16 max-md:h-14 aspect-[2/3] object-cover rounded shrink-0"
                />
              ) : (
                <div className="h-16 max-md:h-14 aspect-[2/3] bg-letterboxd-bg-tertiary rounded shrink-0" />
              )}

              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    "flex items-center justify-between gap-3 h-16 max-md:h-14 px-3 rounded-md bg-letterboxd-bg-tertiary",
                    animated && "bar-grow",
                  )}
                  style={barStyle}
                >
                  <span className="min-w-0 truncate font-bold text-letterboxd-text-primary transition-colors group-hover:text-letterboxd-link-hover">
                    {movie.title}
                  </span>
                  {value !== null && (
                    <span className="movie-stats shrink-0 whitespace-nowrap text-letterboxd-accent">
                      {value}
                    </span>
                  )}
                </div>
              </div>
            </Link>
          </li>
        );
      })}
    </ol>
  );
};

export default MovieBarChart;
