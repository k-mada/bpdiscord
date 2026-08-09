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
          <>
            <span>★&nbsp;{movie.average_rating.toFixed(2)}&nbsp;&nbsp;</span>
            <span>👀&nbsp;&nbsp;{movie.watch_count}</span>
          </>
        );

        return (
          <li
            key={movie.film_slug}
            className="flex items-center gap-4 mb-8 max-md:justify-start before:[counter-increment:movie] before:content-[counter(movie)] before:min-w-12 before:min-h-12 before:border before:border-slate-700 before:flex before:items-center before:justify-center before:font-letterboxdBody before:text-2xl before:movie-counter-text before:rounded-full before:bg-slate-800"
            style={
              animated ? { animationDelay: `${index * 0.2 + 0.5}s` } : undefined
            }
          >
            <div className="flex flex-col w-60">
              <div className="group relative transition-transform hover:scale-105 duration-200  ease-in-out">
                <a
                  href={`https://letterboxd.com/film/${movie.film_slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
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
                    <div className="w-full aspect-[2/3] bg-slate-800" />
                  )}
                </a>
                <div className="pointer-events-none absolute inset-0 hidden items-end justify-center bg-gradient-to-b from-transparent to-slate-900 py-5 text-center text-xl opacity-0 transition-opacity duration-200 ease-in-out group-hover:opacity-100 can-hover:flex">
                  {statLine}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default MovieList;
