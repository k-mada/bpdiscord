import { Link } from "react-router-dom";
import Spinner from "../Spinner";
import { DataTable } from "../DataTable/DataTable";
import { mflFilmSummaryColumns } from "../DataTable/columns";
import { useMflData } from "../../hooks/useMflData";

const Movies = () => {
  const { movies, loading, error } = useMflData();

  return (
    <div>
      <h1 className="type-h1 text-letterboxd-text-primary mb-4">
        Eligible movies
      </h1>
      <p className="text-letterboxd-text-secondary mb-4">
        <Link to="/mfl" className="underline hover:no-underline">
          Back to standings
        </Link>
      </p>

      {!loading && !error && movies.length > 0 && (
        <div className="flex flex-col gap-0.5 type-caption text-letterboxd-text-secondary mb-4">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-letterboxd-accent"></span>
            Eligible for box office points
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-letterboxd-error-surface"></span>
            Not eligible for box office points
          </span>
        </div>
      )}

      {loading && <Spinner />}

      {!loading && error && (
        <p className="text-letterboxd-text-secondary">{error}</p>
      )}

      {!loading && !error && movies.length === 0 && (
        <p className="text-letterboxd-text-secondary">
          No films in the catalogue yet.
        </p>
      )}

      {!loading && !error && movies.length > 0 && (
        <div className="overflow-x-auto max-h-[50vh]">
          <DataTable
            data={movies}
            columns={mflFilmSummaryColumns}
            enableSort
            initialSort={{ key: "totalPoints", direction: "desc" }}
            stickyHeader
          />
        </div>
      )}
    </div>
  );
};

export default Movies;
