import { Link } from "react-router-dom";
import Spinner from "../Spinner";
import { DataTable } from "../DataTable/DataTable";
import { mflFilmSummaryColumns } from "../DataTable/columns";
import { useMflData } from "../../hooks/useMflData";
import { useFillViewportHeight } from "../../hooks/useFillViewportHeight";

const MovieFantasyLeague = () => {
  const { movies, loading, error } = useMflData();
  const { ref, maxHeight } = useFillViewportHeight<HTMLDivElement>();

  return (
    <div>
      <h1 className="text-2xl font-bold text-letterboxd-text-primary mb-4">
        Vulture Movies Fantasy League 2026-2027
      </h1>
      <h2 className="text-xl font-bold text-letterboxd-text-primary mb-4">
        Eligible movies
      </h2>
      <p className="text-letterboxd-text-secondary mb-4">
        <Link to="/mfl/my-picks" className="underline hover:no-underline">
          My picks
        </Link>
        {" · "}
        <Link
          to="/mfl/scoring-reference"
          className="underline hover:no-underline"
        >
          Scoring reference
        </Link>
      </p>

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
        <>
          <div className="mb-4 text-left">
            <span className="ml-2 inline-block w-2 h-2 rounded-full bg-letterboxd-accent"></span>{" "}
            Eligible for box office points
            <br />
            <span className="ml-2 inline-block w-2 h-2 rounded-full bg-letterboxd-error-surface"></span>{" "}
            Not eligible for box office points
          </div>
          <div
            ref={ref}
            className="overflow-x-auto max-h-[50vh]"
            style={maxHeight !== undefined ? { maxHeight } : undefined}
          >
            <DataTable
              data={movies}
              columns={mflFilmSummaryColumns}
              enableSort
              initialSort={{ key: "price", direction: "desc" }}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default MovieFantasyLeague;
