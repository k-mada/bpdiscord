import { useMovieSwap } from "../hooks/useMovieSwap";
import { DataTable } from "./DataTable/DataTable";
import { swapFilmColumns } from "./DataTable/columns";
import CollapsibleSection from "./CollapsibleSection";
import Spinner from "./Spinner";
import type { SwapFilm } from "../../shared/types";

interface MovieSwapProps {
  user1: string;
  user2: string;
  user1Label: string;
  user2Label: string;
}

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SwapList
            films={data.recsForUserA}
            rater={user2Label}
            heading={`Movies ${user2Label} rated that ${user1Label} hasn't seen`}
          />
          <SwapList
            films={data.recsForUserB}
            rater={user1Label}
            heading={`Movies ${user1Label} rated that ${user2Label} hasn't seen`}
          />
        </div>
      )}
    </div>
  );
};

export default MovieSwap;
