import { useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Spinner from "../Spinner";
import { DataTable } from "../DataTable/DataTable";
import { mflLeaderboardColumns } from "../DataTable/columns";
import { useMflLeaderboard } from "../../hooks/useMflLeaderboard";
import { cn } from "../../lib/utils";
import type { MFLLeaderboardEntry } from "../../types";

const TABS = [
  { value: "official", label: "Standings" },
  { value: "sicko", label: "Sicko Mode" },
] as const;

type TabValue = (typeof TABS)[number]["value"];

const deriveNonOfficial = (
  all: MFLLeaderboardEntry[],
  official: MFLLeaderboardEntry[],
): MFLLeaderboardEntry[] => {
  const officialRosterIds = new Set(official.map((entry) => entry.rosterId));
  let lastTotal: number | null = null;
  let lastRank = 0;
  return all
    .filter((entry) => !officialRosterIds.has(entry.rosterId))
    .map((entry, index) => {
      if (entry.totalPoints !== lastTotal) {
        lastRank = index + 1;
        lastTotal = entry.totalPoints;
      }
      return { ...entry, rank: lastRank };
    });
};

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
  const {
    official,
    all,
    loading: standingsLoading,
    error: standingsError,
  } = useMflLeaderboard();

  const nonOfficial = useMemo(
    () => deriveNonOfficial(all, official),
    [all, official],
  );

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
      <h1 className="type-h1 text-letterboxd-text-primary mb-4">
        Vulture Movies Fantasy League 2026-2027
      </h1>
      <p className="text-letterboxd-text-secondary mb-4">
        <Link to="/mfl/my-picks" className="underline hover:no-underline">
          My picks
        </Link>
        {" · "}
        <Link to="/mfl/movies" className="underline hover:no-underline">
          Eligible movies
        </Link>
        {" · "}
        <Link
          to="/mfl/scoring-reference"
          className="underline hover:no-underline"
        >
          Scoring reference
        </Link>
      </p>

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
                "flex-1 -mb-px border-b-2 py-2 text-center type-strong transition-colors",
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
              entries={nonOfficial}
            />
          </>
        )}
      </section>
    </div>
  );
};

export default MovieFantasyLeague;
