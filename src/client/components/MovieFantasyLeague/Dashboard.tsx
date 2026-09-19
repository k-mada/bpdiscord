import { Link } from "react-router-dom";
import Spinner from "../Spinner";
import { DataTable } from "../DataTable/DataTable";
import {
  mflFilmSummaryColumns,
  mflLeaderboardColumns,
} from "../DataTable/columns";
import { useMflData } from "../../hooks/useMflData";
import { useMflLeaderboard } from "../../hooks/useMflLeaderboard";

const MovieFantasyLeague = () => {
  const { movies, loading, error } = useMflData();
  const {
    leaderboard,
    loading: standingsLoading,
    error: standingsError,
  } = useMflLeaderboard();

  return (
    <div>
      <h1 className="text-2xl font-bold text-letterboxd-text-primary mb-4">
        Vulture Movies Fantasy League 2026-2027
      </h1>
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        <section aria-labelledby="mfl-standings-heading">
          <div className="flex items-center min-h-9 mb-4">
            <h2
              id="mfl-standings-heading"
              className="text-xl font-bold text-letterboxd-text-primary"
            >
              Standings
            </h2>
          </div>

          {standingsLoading && <Spinner />}

          {!standingsLoading && standingsError && (
            <p className="text-letterboxd-text-secondary">{standingsError}</p>
          )}

          {!standingsLoading && !standingsError && leaderboard.length === 0 && (
            <p className="text-letterboxd-text-secondary">No standings yet.</p>
          )}

          {!standingsLoading && !standingsError && leaderboard.length > 0 && (
            <div className="overflow-x-auto max-h-[50vh]">
              <DataTable
                data={leaderboard}
                columns={mflLeaderboardColumns}
                enableSort
                initialSort={{ key: "rank", direction: "asc" }}
                stickyHeader
              />
            </div>
          )}
        </section>

        <section aria-labelledby="mfl-movies-heading">
          <div className="flex items-center gap-4 min-h-9 mb-4">
            <h2
              id="mfl-movies-heading"
              className="text-xl font-bold text-letterboxd-text-primary"
            >
              Eligible movies
            </h2>
            {!loading && !error && movies.length > 0 && (
              <div className="flex flex-col gap-0.5 text-xs text-letterboxd-text-secondary">
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
          </div>

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
              <div className="overflow-x-auto max-h-[50vh]">
                <DataTable
                  data={movies}
                  columns={mflFilmSummaryColumns}
                  enableSort
                  initialSort={{ key: "price", direction: "desc" }}
                  stickyHeader
                />
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
};

export default MovieFantasyLeague;
