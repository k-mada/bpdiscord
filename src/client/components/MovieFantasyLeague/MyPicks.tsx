import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Spinner from "../Spinner";
import MovieSelector from "./MovieSelector";
import { Notification, Status } from "../ui/Notification";
import { useMflData } from "../../hooks/useMflData";
import { useAuth } from "../../contexts/AuthContext";
import apiService from "../../services/api";
import { failureMessage } from "../../lib/failureMessage";
import { formatReleaseDate } from "../../utilities";
import { MFLPick } from "../../types";

const MyPicks = () => {
  const { token, user } = useAuth();
  const { movies, loading: catalogueLoading } = useMflData();
  const [picks, setPicks] = useState<MFLPick[]>([]);
  const [rosterTotal, setRosterTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<Status>({ type: "idle" });
  const [busySlug, setBusySlug] = useState<string | null>(null);

  const isLinked = Boolean(user?.lbusername);

  const loadPicks = useCallback(
    async (signal?: AbortSignal) => {
      if (!token) return;
      try {
        const response = await apiService.getMflPicks(token, signal);
        setPicks(response.data?.picks ?? []);
        setRosterTotal(response.data?.rosterTotal ?? 0);
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
        setStatus({ type: "error", message: failureMessage(error) });
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  useEffect(() => {
    if (!token || !isLinked) {
      setLoading(false);
      return;
    }
    const controller = new AbortController();

    async function loadOnMount() {
      await loadPicks(controller.signal);
    }

    loadOnMount();
    return () => controller.abort();
  }, [token, isLinked, loadPicks]);

  // Offering a film already on the roster would only ever produce a 409.
  const available = useMemo(() => {
    const picked = new Set(picks.map((pick) => pick.filmSlug));
    return movies.filter((movie) => !picked.has(movie.filmSlug));
  }, [movies, picks]);

  const handleAdd = async (filmSlug: string) => {
    if (filmSlug === "-1" || !token) return;
    setStatus({ type: "idle" });
    setBusySlug(filmSlug);
    try {
      await apiService.addMflPick(filmSlug, token);
      await loadPicks();
    } catch (error) {
      setStatus({ type: "error", message: failureMessage(error) });
    } finally {
      setBusySlug(null);
    }
  };

  const handleRemove = async (filmSlug: string) => {
    if (!token) return;
    setStatus({ type: "idle" });
    setBusySlug(filmSlug);
    try {
      await apiService.removeMflPick(filmSlug, token);
      await loadPicks();
    } catch (error) {
      setStatus({ type: "error", message: failureMessage(error) });
    } finally {
      setBusySlug(null);
    }
  };

  return (
    <div>
      <p className="text-letterboxd-text-secondary mb-4">
        <Link to="/mfl" className="underline hover:no-underline">
          Eligible films
        </Link>
      </p>
      <h1 className="text-2xl font-bold text-letterboxd-text-primary mb-4">
        My picks
      </h1>

      {!isLinked ? (
        <p className="text-letterboxd-text-secondary">
          Your account has no Letterboxd username linked. Ask an admin to link
          one before picking films.
        </p>
      ) : (
        <>
          {status.type !== "idle" && (
            <div className="mb-4">
              <Notification status={status} />
            </div>
          )}

          <div className="mb-8">
            <MovieSelector movies={available} onMovieSelect={handleAdd} />
          </div>

          {(loading || catalogueLoading) && <Spinner />}

          {!loading && !catalogueLoading && picks.length === 0 && (
            <p className="text-letterboxd-text-secondary">
              You have not picked any films yet.
            </p>
          )}

          {!loading && !catalogueLoading && picks.length > 0 && (
            <table className="data-table">
              <thead>
                <tr>
                  <th scope="col">Film</th>
                  <th scope="col">Released</th>
                  <th scope="col">Price</th>
                  <th scope="col">Points</th>
                  <th scope="col">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {picks.map((pick) => (
                  <tr key={pick.filmSlug}>
                    <td>
                      <Link to={`/mfl/film/${pick.filmSlug}`}>{pick.title}</Link>
                    </td>
                    <td>
                      {pick.releaseDate
                        ? formatReleaseDate(pick.releaseDate)
                        : "TBA"}
                    </td>
                    <td>{pick.price === null ? "TBA" : `$${pick.price}`}</td>
                    <td>{pick.totalPoints}</td>
                    <td>
                      <button
                        type="button"
                        className="underline hover:no-underline"
                        aria-label={`Remove ${pick.title}`}
                        disabled={busySlug === pick.filmSlug}
                        onClick={() => handleRemove(pick.filmSlug)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {/* colSpan rather than empty cells: a bare <td/> is both a
                    lint error and a cell a screen reader stops on for nothing. */}
                <tr className="border-t-2 border-letterboxd-border">
                  <th scope="row" colSpan={3} className="font-bold text-xl text-left py-3 px-4">
                    Roster total
                  </th>
                  <td colSpan={2} className="font-bold text-xl">
                    {rosterTotal}
                  </td>
                </tr>
              </tfoot>
            </table>
          )}
        </>
      )}
    </div>
  );
};

export default MyPicks;
