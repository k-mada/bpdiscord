import { useMemo } from "react";
import { Link } from "react-router-dom";
import Spinner from "../Spinner";
import { DataTable } from "../DataTable/DataTable";
import { mflFilmColumns } from "../DataTable/columns";
import { useMflData } from "../../hooks/useMflData";

const MovieFantasyLeague = () => {
  const { movies, scoringMetrics, loading, error } = useMflData();

  // Every category the season defines, not just the ones something has scored
  // in — otherwise a column appears mid-season on the first award and vanishes
  // again if that award is deleted.
  const categories = useMemo(
    () => [...new Set(scoringMetrics.map((metric) => metric.category))].sort(),
    [scoringMetrics],
  );

  // columns sits in DataTable's sort useMemo dependencies; rebuilding the array
  // inline would re-sort on every render.
  const columns = useMemo(() => mflFilmColumns(categories), [categories]);

  return (
    <div>
      <h2 className="text-xl font-bold text-letterboxd-text-primary mb-4">
        Eligible films
      </h2>
      <p className="text-letterboxd-text-secondary mb-4">
        <Link to="/mfl/scoring-reference" className="underline hover:no-underline">
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
        <div className="overflow-x-auto max-h-50vh">
          <DataTable
            data={movies}
            columns={columns}
            enableSort
            initialSort={{ key: "totalPoints", direction: "desc" }}
          />
        </div>
      )}
    </div>
  );
};

export default MovieFantasyLeague;
