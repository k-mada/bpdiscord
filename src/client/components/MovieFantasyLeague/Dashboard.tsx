import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import Spinner from "../Spinner";
import { DataTable } from "../DataTable/DataTable";
import {
  mflFilmSummaryColumns,
  mflLeaderboardColumns,
} from "../DataTable/columns";
import { useMflData } from "../../hooks/useMflData";
import { useMflLeaderboard } from "../../hooks/useMflLeaderboard";
import { cn } from "../../lib/utils";
import type { MFLLeaderboardEntry } from "../../types";

const TABS = [
  { value: "official", label: "Standings" },
  { value: "sicko", label: "Sicko Mode" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const StandingsPanel = ({
  value,
  active,
  entries,
}: {
  value: TabValue;
  active: boolean;
  entries: MFLLeaderboardEntry[];
}) => (
  <div
    id={`standings-panel-${value}`}
    role="tabpanel"
    aria-labelledby={`standings-tab-${value}`}
    hidden={!active}
  >
    {entries.length === 0 ? (
      <p className="text-letterboxd-text-secondary">No standings yet.</p>
    ) : (
      <div className="overflow-x-auto max-h-[50vh]">
        <DataTable
          data={entries}
          columns={mflLeaderboardColumns}
          enableSort
          initialSort={{ key: "rank", direction: "asc" }}
          stickyHeader
        />
      </div>
    )}
  </div>
);

const MovieFantasyLeague = () => {
  const { movies, loading, error } = useMflData();
  const {
    official,
    all,
    loading: standingsLoading,
    error: standingsError,
  } = useMflLeaderboard();

  const [activeTab, setActiveTab] = useState<TabValue>("official");
  const tablistRef = useRef<HTMLDivElement>(null);

  const handleTabKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const from = TABS.findIndex((tab) => tab.value === activeTab);
    let next: number;
    if (event.key === "ArrowRight") next = (from + 1) % TABS.length;
    else if (event.key === "ArrowLeft")
      next = (from - 1 + TABS.length) % TABS.length;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = TABS.length - 1;
    else return;

    event.preventDefault();
    setActiveTab(TABS[next]!.value);
    tablistRef.current?.querySelectorAll("button")[next]?.focus();
  };

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
          <h2 id="mfl-standings-heading" className="sr-only">
            League standings
          </h2>

          <div
            ref={tablistRef}
            role="tablist"
            aria-label="League standings"
            className="flex mb-4 border-b border-letterboxd-border"
          >
            {TABS.map(({ value, label }) => (
              <button
                key={value}
                role="tab"
                id={`standings-tab-${value}`}
                aria-selected={activeTab === value}
                aria-controls={`standings-panel-${value}`}
                tabIndex={activeTab === value ? 0 : -1}
                onClick={() => setActiveTab(value)}
                onKeyDown={handleTabKeyDown}
                className={cn(
                  "flex-1 -mb-px border-b-2 py-2 text-center font-medium transition-colors",
                  activeTab === value
                    ? "border-letterboxd-accent text-letterboxd-text-primary"
                    : "border-transparent text-letterboxd-text-secondary",
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {standingsLoading && <Spinner />}

          {!standingsLoading && standingsError && (
            <p className="text-letterboxd-text-secondary">{standingsError}</p>
          )}

          {!standingsLoading && !standingsError && (
            <>
              <StandingsPanel
                value="official"
                active={activeTab === "official"}
                entries={official}
              />
              <StandingsPanel
                value="sicko"
                active={activeTab === "sicko"}
                entries={all}
              />
            </>
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
