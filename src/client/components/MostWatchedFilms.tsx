import { Link } from "react-router-dom";
import { useMostWatchedFilms } from "../hooks/useMostWatchedFilms";
import Spinner from "./Spinner";

const MostWatchedFilms = () => {
  const { films, loading, error } = useMostWatchedFilms();

  return (
    <div>
      <h1 className="text-3xl font-bold text-letterboxd-text-primary mb-2">
        The BPD 40 Club
      </h1>
      <h2 className="subheading">
        Films that have been watched by at least 40 members
      </h2>

      {error ? (
        <p role="alert" className="body-text -prose text-letterboxd-error">
          {error}
        </p>
      ) : loading ? (
        <div className="flex justify-center">
          <Spinner />
        </div>
      ) : films.length === 0 ? (
        <p className="body-text -prose italic opacity-70">
          No film has 40 watchers yet.
        </p>
      ) : (
        <ul className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 list-none p-0">
          {films.map((film) => (
            <li key={film.film_slug} className="m-0">
              <Link
                to={`/film/${film.film_slug}`}
                className="group block"
                title={film.title}
              >
                {film.poster ? (
                  <img
                    src={film.poster}
                    alt={film.title}
                    loading="lazy"
                    className="w-full aspect-[2/3] object-cover rounded shadow transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full aspect-[2/3] rounded bg-letterboxd-bg-tertiary flex items-center justify-center p-2 text-center">
                    <span className="text-sm font-bold text-letterboxd-text-primary">
                      {film.title}
                    </span>
                  </div>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default MostWatchedFilms;
