import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Spinner from "../Spinner";
import apiService from "../../services/api";
import { ApiError } from "../../lib/apiError";
import { MFLRosterView } from "../../types";

const RosterView = () => {
  const { rosterId } = useParams<{ rosterId: string }>();
  const [roster, setRoster] = useState<MFLRosterView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!rosterId) return;
    const controller = new AbortController();

    async function loadRoster(id: number) {
      setLoading(true);
      setError(null);
      setNotFound(false);
      try {
        const response = await apiService.getMflRosterView(id, controller.signal);
        setRoster(response.data ?? null);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
          return;
        }
        setError("Failed to load this roster");
      } finally {
        setLoading(false);
      }
    }

    loadRoster(Number(rosterId));
    return () => controller.abort();
  }, [rosterId]);

  const owner = roster && (roster.displayName || roster.lbusername);

  return (
    <div>
      <p className="text-letterboxd-text-secondary mb-4">
        <Link to="/mfl" className="underline hover:no-underline">
          Back to standings
        </Link>
      </p>

      {loading && <Spinner />}

      {!loading && notFound && (
        <p className="text-letterboxd-text-secondary">Roster not found.</p>
      )}

      {!loading && !notFound && error && (
        <p className="text-letterboxd-text-secondary">{error}</p>
      )}

      {!loading && !notFound && !error && roster && (
        <>
          <h2 className="text-xl font-bold text-letterboxd-text-primary mb-1">
            {roster.name}
          </h2>
          <p className="text-letterboxd-text-secondary mb-6">
            by{" "}
            <Link
              to={`/user/${roster.lbusername}`}
              className="underline hover:no-underline"
            >
              {owner}
            </Link>
          </p>

          {roster.picks.length === 0 ? (
            <p className="text-letterboxd-text-secondary">
              This roster has no films yet.
            </p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Film</th>
                  <th scope="col">Price</th>
                  <th scope="col">Points</th>
                </tr>
              </thead>
              <tbody>
                {roster.picks.map((pick) => (
                  <tr key={pick.filmSlug}>
                    <td>{pick.title}</td>
                    <td className="tabular-nums">
                      {pick.price === null ? "—" : `$${pick.price}`}
                    </td>
                    <td className="tabular-nums">{pick.totalPoints}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-letterboxd-border">
                  <td className="font-bold text-xl" colSpan={2}>
                    Total points
                  </td>
                  <td className="font-bold text-xl tabular-nums">
                    {roster.totalPoints}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
        </>
      )}
    </div>
  );
};

export default RosterView;
