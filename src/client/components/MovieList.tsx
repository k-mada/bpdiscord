import { Link } from "react-router-dom";
import { LBFilm } from "../types";
import { cn } from "../lib/utils";

type Size = "sm" | "md" | "lg";

type MovieListProps = {
  size?: Size;
  movies: LBFilm[];
  animated?: boolean;
  showRating?: boolean;
  showCount?: boolean;
  emptyMessage?: string;
};

const MovieList = ({
  movies,
  animated = true,
  showRating = false,
  showCount = false,
  emptyMessage = "No films to show.",
}: MovieListProps) => {
  if (movies.length === 0) {
    return <p className="body-text -prose italic opacity-70">{emptyMessage}</p>;
  }

  return (
    <ol
      className={cn(
        "list-none [counter-reset:movie]",
        animated && "movie-poster-fade-in",
      )}
    >
      {movies.map((movie, index: number) => {
        const statLine = (
          <div className="ml-4">
            {showRating && (
              <span>
                <span aria-hidden="true">★&nbsp;</span>
                <span className="sr-only">Average rating </span>
                <span>{movie.average_rating.toFixed(2)}</span>
              </span>
            )}
            {showCount && (
              <span>
                <span aria-hidden="true">👀&nbsp;</span>
                <span className="sr-only">Watched by </span>
                <span>{movie.watch_count}</span>
              </span>
            )}
          </div>
        );

        return (
          <li
            key={movie.film_slug}
            className="flex items-center gap-4 mb-8 max-md:justify-start before:[counter-increment:movie] before:content-[counter(movie)] before:min-w-12 before:min-h-12 before:border before:border-letterboxd-border before:flex before:items-center before:justify-center before:font-letterboxdBody before:text-[1.5rem] before:movie-counter-text before:rounded-full before:bg-letterboxd-bg-secondary"
            style={
              animated ? { animationDelay: `${index * 0.2 + 0.5}s` } : undefined
            }
          >
            <div className="flex flex-col w-60">
              <div className="group relative transition-transform hover:scale-105 duration-500 ease-in-out">
                <Link to={`/film/${movie.film_slug}`}>
                  {movie.poster ? (
                    <img
                      src={movie.poster}
                      alt={`${movie.title ?? movie.film_slug} poster`}
                      width={230}
                      height={345}
                      loading="lazy"
                      className="w-full aspect-[2/3] object-cover"
                    />
                  ) : (
                    <div className="w-full aspect-[2/3] bg-letterboxd-bg-secondary" />
                  )}
                </Link>
                <div className="pointer-events-none absolute inset-0 hidden items-end bg-gradient-to-b from-transparent to-letterboxd-bg-primary py-5 type-h2 opacity-0 transition-opacity duration-500 ease-in-out group-hover:opacity-100 group-has-[:focus-visible]:opacity-100 hover-desktop:flex">
                  {statLine}
                </div>
              </div>
              {(showRating || showCount) && (
                <div className="py-2 type-h2 text-left hover-desktop:hidden">
                  {statLine}
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default MovieList;
