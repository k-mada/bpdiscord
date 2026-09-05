import { useMemo, useState } from "react";
import MovieSelector from "./MovieSelector";
import { MFLScoringMetric, MFLMovieScore } from "../../types";
import { Modal, ModalHeader, ModalBody } from "../Modal";
import Spinner from "../Spinner";
import { useMflData } from "../../hooks/useMflData";
import { useAuth } from "../../contexts/AuthContext";
import { Notification, Status } from "../ui/Notification";
import { ApiError } from "../../lib/apiError";

// A 4xx body is written for the admin to read — the 409 naming a duplicate
// award is the whole point. A 5xx body is dbMutation's raw Postgres message,
// constraint names and all, so it never reaches the screen.
const failureMessage = (error: unknown): string => {
  if (error instanceof ApiError && error.status < 500) return error.message;
  return "Something went wrong. Please try again.";
};

const getMetricById = (
  scoringMetrics: MFLScoringMetric[],
  metricId: number,
) => {
  return scoringMetrics.find((metric) => metric.metricId === metricId);
};

const getMovieScoreByMetricId = (
  movieScore: MFLMovieScore[],
  metricId: number,
) => {
  return movieScore.find((score) => score.metricId === metricId);
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

  // selected scoring metric after user selects a movie
  const [selectedMetric, setSelectedMetric] = useState<MFLScoringMetric | null>(
    null,
  );

  const [movieScore, setMovieScore] = useState<MFLMovieScore[]>([]); // list of scores for the selected movie
  const [currentSelectedMovie, setCurrentSelectedMovie] = useState<string>("");
  const [totalPoints, setTotalPoints] = useState(0); // total points for the selected movie
  // loading state
  const [loading, setLoading] = useState(false);
  const [disableScoreInput, setDisableScoreInput] = useState(true);
  const [inputPointsAwarded, setInputPointsAwarded] = useState(0);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedScoringId, setSelectedScoringId] = useState<number>(0);
  const [formStatus, setFormStatus] = useState<Status>({ type: "idle" });
  const [deleteStatus, setDeleteStatus] = useState<Status>({ type: "idle" });
  const customizableMetricIds = [1, 10, 338];

  const handleMetricSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const metricId = parseInt(event.target.value);

    const selectedMetric = getMetricById(scoringMetrics, metricId);
    if (selectedMetric) {
      setSelectedMetric(selectedMetric);
      setInputPointsAwarded(selectedMetric.pointValue);
      if (customizableMetricIds.includes(selectedMetric.metricId)) {
        setDisableScoreInput(false);
      } else {
        setDisableScoreInput(true);
      }
    }
  };

  const resetForm = () => {
    setSelectedScoringId(0);
    setInputPointsAwarded(0);
    // setSelectedMetric(null);
    setDisableScoreInput(true);
  };

  const handleMovieSelect = async (filmSlug: string) => {
    if (filmSlug === "-1") return;

    setLoading(true);
    setFormStatus({ type: "idle" });
    try {
      const selectedMovieScore = await getMovieScore(filmSlug);
      const sortedSelectedMovieScore = selectedMovieScore.sort((a, b) => {
        if (a.metricName < b.metricName) {
          return -1;
        }
        if (a.metricName > b.metricName) {
          return 1;
        }
        return 0;
      });
      if (sortedSelectedMovieScore) {
        const totalPoints = sortedSelectedMovieScore.reduce(
          (acc, curr) => acc + curr.pointsAwarded,
          0,
        );
        setTotalPoints(totalPoints);
        setMovieScore(sortedSelectedMovieScore);
        setCurrentSelectedMovie(filmSlug);
        setInputPointsAwarded(0);
        setSelectedMetric(null);
      }
    } catch (error) {
      setFormStatus({ type: "error", message: failureMessage(error) });
    } finally {
      setLoading(false);
    }
  };

  const movieTitle = useMemo(() => {
    return movies.find((movie) => movie.filmSlug === movieScore[0]?.filmSlug)
      ?.title;
  }, [movieScore, movies]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!selectedMetric?.metricId) return;

    const existingScore = getMovieScoreByMetricId(
      movieScore,
      selectedMetric.metricId,
    );

    setFormStatus({ type: "idle" });
    try {
      const isEdit = Boolean(existingScore && selectedScoringId > 0);
      await upsertMovieScore(
        {
          filmSlug: isEdit ? existingScore!.filmSlug : currentSelectedMovie,
          pointsAwarded: inputPointsAwarded,
          metricId: selectedMetric.metricId,
          ...(isEdit ? { scoringId: existingScore!.scoringId } : {}),
        },
        token ?? "",
      );

      // Only on success: a rejected submit keeps the admin's input so the fix
      // is one edit away rather than a full re-entry.
      resetForm();
      setFormStatus({ type: "success", message: "Score saved." });

      if (currentSelectedMovie) {
        const refreshedMovieScore = await getMovieScore(currentSelectedMovie);
        if (refreshedMovieScore) {
          const totalPoints = refreshedMovieScore.reduce(
            (acc, curr) => acc + curr.pointsAwarded,
            0,
          );
          setTotalPoints(totalPoints);
          setMovieScore(refreshedMovieScore);
        }
      }
    } catch (error) {
      setFormStatus({ type: "error", message: failureMessage(error) });
    }
  };

  const handlePointsAwardedChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setInputPointsAwarded(parseInt(event.target.value));
  };

  const handleEditMetric = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    const scoringId = event.currentTarget.getAttribute("data-scoring-id");
    if (scoringId) {
      const existingScoringId = parseInt(scoringId);
      setSelectedScoringId(existingScoringId);

      const score = movieScore.find(
        (score: MFLMovieScore) => score.scoringId === existingScoringId,
      );
      if (score) {
        setInputPointsAwarded(score.pointsAwarded);

        const selectedMetric = getMetricById(scoringMetrics, score.metricId);
        if (selectedMetric) {
          setSelectedMetric(selectedMetric);
        }
        if (customizableMetricIds.includes(score.metricId)) {
          setDisableScoreInput(false);
        } else {
          setDisableScoreInput(true);
        }
      }
    }
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
        const refreshedMovieScore = await getMovieScore(currentSelectedMovie);
        if (refreshedMovieScore) {
          const totalPoints = refreshedMovieScore.reduce(
            (acc, curr) => acc + curr.pointsAwarded,
            0,
          );
          setTotalPoints(totalPoints);
          setMovieScore(refreshedMovieScore);
        }
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
      <button
        type="button"
        className="px-8 underline hover:no-underline"
        onClick={() => handleDeleteMetric(scoringId)}
      >
        Delete
      </button>
    );
  };

  const EditMetric = ({ scoringId }: { scoringId: number }) => {
    return (
      <button
        type="button"
        className="px-8 underline hover:no-underline"
        onClick={handleEditMetric}
        data-scoring-id={scoringId}
      >
        Edit
      </button>
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
          Are you sure you want to delete this metric?
        </ModalHeader>
        <ModalBody>
          <p>This action cannot be undone.</p>
          {deleteStatus.type !== "idle" && (
            <div className="my-4">
              <Notification status={deleteStatus} />
            </div>
          )}
          <div>
            <button
              type="button"
              className="btn-primary mx-2"
              onClick={handleConfirmDeleteMetric}
            >
              Delete
            </button>
            <button
              type="button"
              className="btn-secondary mx-2"
              onClick={handleClose}
            >
              Cancel
            </button>
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

      <form
        onSubmit={handleSubmit}
        className="my-8 rounded-lg border-2 border-letterboxd-border p-4"
      >
        <h2 className="text-xl text-letterboxd-text-primary mb-4">
          Add new score for{" "}
          <span className="font-bold letterboxd-text-accent">{movieTitle}</span>
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
            className="text-black"
            onChange={handlePointsAwardedChange}
          />
        </div>

        <button type="submit" className="btn-primary">
          Add score
        </button>
      </form>

      {loading && <Spinner />}
      {!loading && movieScore.length > 0 && (
        <div className="flex flex-col gap-2">
          <table className="data-table">
            <thead>
              <tr>
                <th>Scoring Metric</th>
                <th>Points Awarded</th>
              </tr>
            </thead>
            <tbody>
              {movieScore.map((score, id) => {
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
                  <tr key={id}>
                    <td>{scoringMetric}</td>
                    <td>
                      {score.pointsAwarded}
                      {!customizableMetricIds.includes(score.metricId) ? (
                        <DeleteMetric scoringId={score.scoringId} />
                      ) : (
                        <EditMetric scoringId={score.scoringId} />
                      )}
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
  );
};

export default MFLAdmin;
