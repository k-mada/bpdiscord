import { useMostWatchedFilms } from "../hooks/useMostWatchedFilms";
import MovieBarChart from "./MovieBarChart";
import Spinner from "./Spinner";

const MostWatchedFilms = () => {
  const { films, loading, error } = useMostWatchedFilms();

  return (
    <div>
      <h1 className="text-3xl font-bold text-letterboxd-text-primary mb-2">
        Most watched movies
      </h1>
      <h2 className="subheading">
        The top 50 most watched movies by the server
      </h2>

      {error ? (
        <p role="alert" className="body-text -prose text-letterboxd-error">
          {error}
        </p>
      ) : loading ? (
        <div className="flex justify-center">
          <Spinner />
        </div>
      ) : (
        <MovieBarChart
          movies={films}
          showCount={true}
          showRank={true}
          emptyMessage="No film has 30 watchers yet."
        />
      )}
    </div>
  );
};

export default MostWatchedFilms;
