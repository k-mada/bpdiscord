import { useMemo, useState } from "react";
import { useMovieSwap } from "../hooks/useMovieSwap";
import { DataTable } from "./DataTable/DataTable";
import { swapFilmColumns } from "./DataTable/columns";
import CollapsibleSection from "./CollapsibleSection";
import Spinner from "./Spinner";
import type { SwapFilm } from "../../shared/types";

type SortBy = "rating" | "title";

// rating: desc, unrated last, title tiebreak (mirrors the server default order)
function sortSwapFilms(films: SwapFilm[], by: SortBy): SwapFilm[] {
  const out = [...films];
  if (by === "title") {
    out.sort((a, b) => a.title.localeCompare(b.title));
  } else {
    out.sort((a, b) => {
      const ra = a.user_rating;
      const rb = b.user_rating;
      if (ra === rb) return a.title.localeCompare(b.title);
      if (ra === null) return 1;
      if (rb === null) return -1;
      return rb - ra;
    });
  }
  return out;
}

interface MovieSwapProps {
  user1: string;
  user2: string;
  user1Label: string;
  user2Label: string;
}

const SortToggle = ({
  sortBy,
  onChange,
}: {
  sortBy: SortBy;
  onChange: (by: SortBy) => void;
}) => {
  const cls = (active: boolean) =>
    `px-3 py-1 rounded text-sm border border-letterboxd-border ${
      active
        ? "bg-letterboxd-accent text-white"
        : "text-letterboxd-text-secondary hover:text-letterboxd-text-primary"
    }`;

  return (
    <div
      className="flex items-center gap-2 mb-4"
      role="group"
      aria-label="Sort films"
    >
      <span className="text-letterboxd-text-secondary text-sm">Sort:</span>
      <button
        type="button"
        onClick={() => onChange("rating")}
        aria-pressed={sortBy === "rating"}
        className={cls(sortBy === "rating")}
      >
        Rating
      </button>
      <button
        type="button"
        onClick={() => onChange("title")}
        aria-pressed={sortBy === "title"}
        className={cls(sortBy === "title")}
      >
        A–Z
      </button>
    </div>
  );
};

interface SwapListProps {
  films: SwapFilm[];
  rater: string;
  heading: string;
}

const SwapList = ({ films, rater, heading }: SwapListProps) => (
  <CollapsibleSection title={`${heading} (${films.length})`}>
    {films.length === 0 ? (
      <p className="text-letterboxd-text-muted">Nothing to recommend.</p>
    ) : (
      <div className="overflow-x-auto max-h-50vh">
        <DataTable
          data={films}
          columns={swapFilmColumns}
          enableSort={false}
          headerContext={{ rater }}
        />
      </div>
    )}
  </CollapsibleSection>
);

const MovieSwap = ({
  user1,
  user2,
  user1Label,
  user2Label,
}: MovieSwapProps) => {
  const { data, loading, error } = useMovieSwap(user1, user2);
  const [sortBy, setSortBy] = useState<SortBy>("rating");

  const recsForUserA = useMemo(
    () => (data ? sortSwapFilms(data.recsForUserA, sortBy) : []),
    [data, sortBy],
  );
  const recsForUserB = useMemo(
    () => (data ? sortSwapFilms(data.recsForUserB, sortBy) : []),
    [data, sortBy],
  );

  return (
    <div className="card">
      <h3 className="subheading">Movie Swap</h3>
      <p className="text-letterboxd-text-secondary mb-4">
        Films each user has rated that the other hasn't seen.
      </p>

      {loading && <Spinner />}

      {error && (
        <div className="card border-red-500/30 bg-red-900/10">
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {data && !loading && (
        <>
          <SortToggle sortBy={sortBy} onChange={setSortBy} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <SwapList
              films={recsForUserA}
              rater={user2Label}
              heading={`Movies ${user2Label} rated that ${user1Label} hasn't seen`}
            />
            <SwapList
              films={recsForUserB}
              rater={user1Label}
              heading={`Movies ${user1Label} rated that ${user2Label} hasn't seen`}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default MovieSwap;
