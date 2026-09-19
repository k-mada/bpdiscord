import { useMemo, useState } from "react";
import MovieSelector from "./MovieSelector";
import { MFLScoringMetric, MFLMovieScore } from "../../types";
import { Modal, ModalHeader, ModalBody } from "../Modal";
import Spinner from "../Spinner";
import { useMflData } from "../../hooks/useMflData";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/Button";
import { Notification, Status } from "../ui/Notification";
import { failureMessage } from "../../lib/failureMessage";

const getMetricById = (
  scoringMetrics: MFLScoringMetric[],
  metricId: number,
) => {
  return scoringMetrics.find((metric) => metric.metricId === metricId);
};

const MFLAdmin = () => {
  const { token, user, loading: authLoading } = useAuth();
  const isAdmin = user?.role === "admin";
  const {
    movies,
    scoringMetrics: rawScoringMetrics,
    getMovieScore,
    upsertMovieScore,
    deleteScore,
  } = useMflData();

  const scoringMetrics = useMemo(() => {
    return [...rawScoringMetrics].sort((a, b) =>
      a.metricName < b.metricName ? -1 : a.metricName > b.metricName ? 1 : 0,
    );
  }, [rawScoringMetrics]);

  const [selectedMetric, setSelectedMetric] = useState<MFLScoringMetric | null>(
    null,
  );
  const [movieScore, setMovieScore] = useState<MFLMovieScore[]>([]);
  const [currentSelectedMovie, setCurrentSelectedMovie] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [disableScoreInput, setDisableScoreInput] = useState(true);
  const [inputPointsAwarded, setInputPointsAwarded] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedScoringId, setSelectedScoringId] = useState<number>(0);
  const [formStatus, setFormStatus] = useState<Status>({ type: "idle" });
  const [deleteStatus, setDeleteStatus] = useState<Status>({ type: "idle" });
  const customizableMetricIds = [1, 10, 338];

  // Scores render in the dropdown's order, keyed by each metric's position in
  // the (metricName-sorted) list so the two panels never disagree.
  const orderedMovieScore = useMemo(() => {
    const rank = new Map(
      scoringMetrics.map((metric, index) => [metric.metricId, index]),
    );
    const fallback = scoringMetrics.length;
    return [...movieScore].sort(
      (a, b) =>
        (rank.get(a.metricId) ?? fallback) - (rank.get(b.metricId) ?? fallback),
    );
  }, [movieScore, scoringMetrics]);

  const totalPoints = useMemo(
    () => movieScore.reduce((acc, curr) => acc + curr.pointsAwarded, 0),
    [movieScore],
  );

  const movieTitle = useMemo(
    () => movies.find((movie) => movie.filmSlug === currentSelectedMovie)?.title,
    [movies, currentSelectedMovie],
  );

  const handleMetricSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const metricId = parseInt(event.target.value);
    const metric = getMetricById(scoringMetrics, metricId);
    if (metric) {
      setSelectedMetric(metric);
      setInputPointsAwarded(metric.pointValue);
      setDisableScoreInput(!customizableMetricIds.includes(metric.metricId));
    }
  };

  const resetForm = () => {
    setSelectedMetric(null);
    setInputPointsAwarded(0);
    setDisableScoreInput(true);
  };

  const refreshScores = async (filmSlug: string) => {
    const scores = await getMovieScore(filmSlug);
    setMovieScore(scores ?? []);
  };

  const handleMovieSelect = async (filmSlug: string) => {
    resetForm();
    if (filmSlug === "-1") {
      setCurrentSelectedMovie("");
      setMovieScore([]);
      return;
    }

    setLoading(true);
    setFormStatus({ type: "idle" });
    try {
      await refreshScores(filmSlug);
      setCurrentSelectedMovie(filmSlug);
    } catch (error) {
      setFormStatus({ type: "error", message: failureMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedMetric?.metricId || !currentSelectedMovie) return;

    setFormStatus({ type: "idle" });
    try {
      await upsertMovieScore(
        {
          filmSlug: currentSelectedMovie,
          pointsAwarded: inputPointsAwarded,
          metricId: selectedMetric.metricId,
        },
        token ?? "",
      );

      // Only on success: a rejected submit keeps the admin's input so the fix
      // is one edit away rather than a full re-entry.
      resetForm();
      setFormStatus({ type: "success", message: "Score saved." });
      await refreshScores(currentSelectedMovie);
    } catch (error) {
      setFormStatus({ type: "error", message: failureMessage(error) });
    }
  };

  const handlePointsAwardedChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setInputPointsAwarded(parseInt(event.target.value));
  };

  const handleClose = () => {
    setSelectedScoringId(0);
    setDeleteStatus({ type: "idle" });
    setIsModalOpen(false);
  };

  const handleDeleteMetric = (scoringId: number) => {
    setSelectedScoringId(scoringId);
    setIsModalOpen(true);
  };

  const handleConfirmDeleteMetric = async () => {
    if (selectedScoringId <= 0) {
      setIsModalOpen(false);
      return;
    }

    setDeleteStatus({ type: "idle" });
    try {
      await deleteScore(selectedScoringId, token ?? "");
      if (currentSelectedMovie) {
        await refreshScores(currentSelectedMovie);
      }
      // Closing only here: a dialog that dismisses itself on failure reads as
      // success, and the admin loses the row they were trying to delete.
      setIsModalOpen(false);
      setSelectedScoringId(0);
    } catch (error) {
      setDeleteStatus({ type: "error", message: failureMessage(error) });
    }
  };

  const DeleteMetric = ({ scoringId }: { scoringId: number }) => {
    return (
      <Button
        type="button"
        variant="link"
        className="px-8"
        onClick={() => handleDeleteMetric(scoringId)}
      >
        Delete
      </Button>
    );
  };

  // Wait for /me to resolve before judging the gate — otherwise an admin sees
  // a flash of "Access denied" while the identity round-trip is in flight.
  if (authLoading) {
    return (
      <div className="card text-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!isAdmin) {
    // Same treatment as admin/UserAdmin.tsx. UX only — the real gate is
    // authorizeAdmin on /api/mfl/admin/*.
    return (
      <div className="card border rounded-lg border-letterboxd-error-surface/60 bg-letterboxd-error-surface/20 text-letterboxd-text-primary">
        <p className="font-semibold text-letterboxd-error">Access denied</p>
        <p className="text-letterboxd-text-primary text-sm mt-1">
          This page is only available to admin accounts.
        </p>
      </div>
    );
  }

  return (
    <div>
      <Modal isOpen={isModalOpen} onClose={handleClose}>
        <ModalHeader onClose={handleClose}>
          Are you sure you want to delete this score?
        </ModalHeader>
        <ModalBody>
          <p>This action cannot be undone.</p>
          {deleteStatus.type !== "idle" && (
            <div className="my-4">
              <Notification status={deleteStatus} />
            </div>
          )}
          <div>
            <Button
              type="button"
              className="mx-2"
              onClick={handleConfirmDeleteMetric}
            >
              Delete
            </Button>
            <Button
              type="button"
              variant="secondary"
              className="mx-2"
              onClick={handleClose}
            >
              Cancel
            </Button>
          </div>
        </ModalBody>
      </Modal>
      <h1 className="text-2xl font-bold text-letterboxd-text-primary mb-4">
        MFL Admin
      </h1>
      {formStatus.type !== "idle" && (
        <div className="mb-4">
          <Notification status={formStatus} />
        </div>
      )}
      <MovieSelector movies={movies} onMovieSelect={handleMovieSelect} />

      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <form
          onSubmit={handleSubmit}
          className="rounded-lg border-2 border-letterboxd-border p-4"
        >
          <h2 className="text-xl text-letterboxd-text-primary mb-4">
            Add new score for{" "}
            <span className="font-bold letterboxd-text-accent">
              {movieTitle ?? "…"}
            </span>
            :
          </h2>
          <div className="my-8">
            <label htmlFor="lst-metric" className="mr-8">
              Scoring metric:
            </label>
            <select
              id="lst-metric"
              className="input-field w-1/2"
              value={selectedMetric?.metricId || "-1"}
              onChange={handleMetricSelect}
            >
              <option value="-1">select a scoring metric</option>
              {scoringMetrics.map((metric) => {
                return (
                  <option key={metric.metricId} value={metric.metricId}>
                    {metric.metricName} - {metric.category} -{" "}
                    {metric.scoringCondition}
                  </option>
                );
              })}
            </select>
          </div>
          <div className="my-8">
            <label htmlFor="txt-points-awarded" className="mr-8">
              Points awarded:
            </label>
            <input
              type="text"
              id="txt-points-awarded"
              value={inputPointsAwarded}
              disabled={disableScoreInput}
              onChange={handlePointsAwardedChange}
            />
          </div>

          <Button type="submit" disabled={!currentSelectedMovie}>
            Add score
          </Button>
        </form>

        <div className="rounded-lg border-2 border-letterboxd-border p-4">
          <h2 className="text-xl text-letterboxd-text-primary mb-4">
            Scores for{" "}
            <span className="font-bold letterboxd-text-accent">
              {movieTitle ?? "…"}
            </span>
          </h2>
          {loading && <Spinner />}
          {!loading && !currentSelectedMovie && (
            <p className="text-letterboxd-text-secondary">
              Select a movie to see its scores.
            </p>
          )}
          {!loading && currentSelectedMovie && movieScore.length === 0 && (
            <p className="text-letterboxd-text-secondary">
              No scores yet for this movie.
            </p>
          )}
          {!loading && movieScore.length > 0 && (
            <div className="overflow-x-auto">
              <table className="data-table">
              <thead>
                <tr>
                  <th>Scoring Metric</th>
                  <th>Points Awarded</th>
                </tr>
              </thead>
              <tbody>
                {orderedMovieScore.map((score) => {
                  let scoringMetric: string;
                  if (
                    score.metricName === "gross" ||
                    score.metricName === "rank"
                  ) {
                    scoringMetric = `${score.metricName} ${score.category}`;
                  } else {
                    scoringMetric = `${score.metricName}  -${score.category} (${score.scoringCondition})`;
                  }
                  return (
                    <tr key={score.scoringId}>
                      <td>{scoringMetric}</td>
                      <td>
                        {score.pointsAwarded}
                        <DeleteMetric scoringId={score.scoringId} />
                      </td>
                    </tr>
                  );
                })}
                <tr className="border-t-2 border-letterboxd-border">
                  <td className="font-bold text-xl">Total points:</td>
                  <td className="font-bold text-xl">{totalPoints}</td>
                </tr>
              </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MFLAdmin;
