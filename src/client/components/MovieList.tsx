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
        // TODO: MAKE THIS MORE RESPONSIVE LATER
        const posterUrl =
          movie.poster?.replace("0-230-0-345", "0-150-0-225") ?? "";

        return (
          <li
            key={movie.film_slug}
            className={cn(
              "flex items-center gap-4 mb-8",
              "max-md:justify-start",
              "before:[counter-increment:movie] before:content-[counter(movie)]",
              "before:min-w-12 before:min-h-12",
              "before:border before:border-slate-700",
              "before:flex before:items-center before:justify-center",
              "before:font-letterboxdBody before:text-2xl",
              "before:movie-counter-text",
              "before:rounded-full before:bg-slate-800",
            )}
            style={
              animated ? { animationDelay: `${index * 0.2 + 0.5}s` } : undefined
            }
          >
            <div className={cn("max-w-[230px]")}>
              <a
                href={`https://letterboxd.com/film/${movie.film_slug}`}
                target="_blank"
              >
                <img
                  src={posterUrl}
                  alt={movie.title ?? ""}
                  className="border rounded-t-md border-slate-500 border-b-0 rounded-b-none"
                />
              </a>
              <div className="movie-stats">
                {showRating && (
                  <div className="h-10 p-1 text-center border rounded-b-md border-t-0  border-slate-500 bg-slate-800">
                    ★&nbsp;{movie.average_rating.toFixed(2) ?? 0}
                  </div>
                )}
                {showCount && (
                  <div className="h-10 p-1 text-center border rounded-b-md border-t-0  border-slate-500 bg-slate-800">
                    👀&nbsp;&nbsp;{`${movie.watch_count ?? 0}`}
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
};

export default MovieList;
