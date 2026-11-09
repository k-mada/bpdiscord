import Card from "../Card";
import { useMemo, useState } from "react";
import MovieSelector from "./MovieSelector";
import { MFLScoringMetric, MFLMovieScore } from "../../types";
import { Modal, ModalHeader, ModalBody } from "../Modal";
import Spinner from "../Spinner";
import { useMflData } from "../../hooks/useMflData";
import { useAuth } from "../../contexts/AuthContext";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Notification, Status } from "../ui/Notification";
import { failureMessage } from "../../lib/failureMessage";

const getMetricById = (
  scoringMetrics: MFLScoringMetric[],
  metricId: number,
) => {
  return scoringMetrics.find((metric) => metric.metricId === metricId);
};

// Gross "every $1M" climbs with box office and weeks-at-#1 climbs by weeks, so
// both edit in place; the fixed "cleared $X" awards only ever add or delete.
const isEditableScore = (score: MFLMovieScore) =>
  (score.metricName === "gross" &&
    score.category.toLowerCase().includes("every")) ||
  isWeeksMetric(score.metricName);

// Weeks-at-#1 stores points (weeks × pointValue) like any score; the dropdown is
// just a view over that value, so add/edit/total never special-case it.
const WEEKS_OPTIONS = Array.from({ length: 10 }, (_, i) => i + 1);
const isWeeksMetric = (metricName: string) => metricName === "rank";
const pointsToWeeks = (points: number, pointValue: number): string =>
  pointValue > 0 &&
  points > 0 &&
  points % pointValue === 0 &&
  points / pointValue <= 10
    ? String(points / pointValue)
    : "";
const weeksToPoints = (weeks: string, pointValue: number): number =>
  weeks === "" ? 0 : Number(weeks) * pointValue;

const MFLAdmin = () => {
  const { token, user, loading: authLoading } = useAuth();
  const canEditScores = user?.role === "admin" || user?.role === "editor";
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
  const [editingScoringId, setEditingScoringId] = useState<number | null>(null);
  const [editPoints, setEditPoints] = useState(0);
  const [editSaving, setEditSaving] = useState(false);
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
    () =>
      movies.find((movie) => movie.filmSlug === currentSelectedMovie)?.title,
    [movies, currentSelectedMovie],
  );

  const handleMetricSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const metricId = parseInt(event.target.value);
    const metric = getMetricById(scoringMetrics, metricId);
    if (metric) {
      setSelectedMetric(metric);
      setInputPointsAwarded(
        isWeeksMetric(metric.metricName) ? 0 : metric.pointValue,
      );
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
    const raw = event.target.value;
    if (raw === "") {
      setInputPointsAwarded(0);
      return;
    }
    // Ignore non-numeric input so the controlled field never latches NaN.
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed)) {
      setInputPointsAwarded(parsed);
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

  const handleStartEdit = (score: MFLMovieScore) => {
    setFormStatus({ type: "idle" });
    setEditingScoringId(score.scoringId);
    setEditPoints(score.pointsAwarded);
  };

  const handleCancelEdit = () => {
    setEditingScoringId(null);
  };

  const handleEditPointsChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const raw = event.target.value;
    if (raw === "") {
      setEditPoints(0);
      return;
    }
    const parsed = parseInt(raw, 10);
    if (!Number.isNaN(parsed)) {
      setEditPoints(parsed);
    }
  };

  const handleSaveEdit = async (score: MFLMovieScore) => {
    setEditSaving(true);
    setFormStatus({ type: "idle" });
    try {
      await upsertMovieScore(
        {
          filmSlug: score.filmSlug,
          pointsAwarded: editPoints,
          metricId: score.metricId,
          scoringId: score.scoringId,
        },
        token ?? "",
      );
      setEditingScoringId(null);
      setFormStatus({ type: "success", message: "Score updated." });
      await refreshScores(score.filmSlug);
    } catch (error) {
      setFormStatus({ type: "error", message: failureMessage(error) });
    } finally {
      setEditSaving(false);
    }
  };

  const DeleteMetric = ({
    scoringId,
    label,
  }: {
    scoringId: number;
    label: string;
  }) => {
    return (
      <Button
        type="button"
        variant="destructive"
        size="sm"
        aria-label={`Delete ${label}`}
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
      <Card className="text-center py-12">
        <Spinner />
      </Card>
    );
  }

  if (!canEditScores) {
    // Same treatment as admin/UserAdmin.tsx. UX only — the real gate is
    // authorizeEditor on /api/mfl/admin/*.
    return (
      <Card className="border rounded-lg border-letterboxd-error-surface/60 bg-letterboxd-error-surface/20 text-letterboxd-text-primary">
        <p className="type-strong text-letterboxd-error">Access denied</p>
        <p className="text-letterboxd-text-primary type-body-sm mt-1">
          This page is only available to editor and admin accounts.
        </p>
      </Card>
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
      <h1 className="type-h1 text-letterboxd-text-primary mb-4">MFL Admin</h1>
      {formStatus.type !== "idle" && (
        <div className="mb-4">
          <Notification status={formStatus} />
        </div>
      )}
      <MovieSelector movies={movies} onMovieSelect={handleMovieSelect} />

      {currentSelectedMovie && (
        <div className="mt-8 grid gutter-lg md:grid-cols-2">
          <form
            onSubmit={handleSubmit}
            className="rounded-lg border-2 border-letterboxd-border pad-card"
          >
            <h2 className="type-h2 text-letterboxd-text-primary mb-4">
              Add new score for{" "}
              <span className="text-letterboxd-accent">
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
            {selectedMetric && isWeeksMetric(selectedMetric.metricName) ? (
              <div className="my-8">
                <label htmlFor="lst-weeks" className="mr-8">
                  Number of weeks:
                </label>
                <select
                  id="lst-weeks"
                  className="input-field w-1/2"
                  value={pointsToWeeks(
                    inputPointsAwarded,
                    selectedMetric.pointValue,
                  )}
                  onChange={(event) =>
                    setInputPointsAwarded(
                      weeksToPoints(
                        event.target.value,
                        selectedMetric.pointValue,
                      ),
                    )
                  }
                >
                  <option value="">select weeks</option>
                  {WEEKS_OPTIONS.map((weeks) => (
                    <option key={weeks} value={weeks}>
                      {weeks}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="my-8">
                <label htmlFor="txt-points-awarded" className="mr-8">
                  Points awarded:
                </label>
                <Input
                  type="text"
                  id="txt-points-awarded"
                  value={inputPointsAwarded}
                  disabled={disableScoreInput}
                  onChange={handlePointsAwardedChange}
                />
              </div>
            )}

            <Button
              type="submit"
              disabled={
                !currentSelectedMovie ||
                (!!selectedMetric &&
                  isWeeksMetric(selectedMetric.metricName) &&
                  inputPointsAwarded <= 0)
              }
            >
              Add score
            </Button>
          </form>

          <div className="rounded-lg border-2 border-letterboxd-border pad-card">
            <h2 className="type-h2 text-letterboxd-text-primary mb-4">
              Scores for{" "}
              <span className="text-letterboxd-accent">
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
                      <th>
                        <span className="sr-only">Actions</span>
                      </th>
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
                      const isEditing = editingScoringId === score.scoringId;
                      const metricPointValue =
                        getMetricById(scoringMetrics, score.metricId)
                          ?.pointValue ?? 0;
                      const editAsWeeks =
                        isWeeksMetric(score.metricName) &&
                        metricPointValue > 0;
                      return (
                        <tr key={score.scoringId}>
                          <td>{scoringMetric}</td>
                          <td>
                            {isEditing && editAsWeeks ? (
                              <select
                                className="input-field w-24"
                                aria-label={`Weeks for ${scoringMetric}`}
                                value={pointsToWeeks(
                                  editPoints,
                                  metricPointValue,
                                )}
                                onChange={(event) =>
                                  setEditPoints(
                                    weeksToPoints(
                                      event.target.value,
                                      metricPointValue,
                                    ),
                                  )
                                }
                              >
                                <option value="">select weeks</option>
                                {WEEKS_OPTIONS.map((weeks) => (
                                  <option key={weeks} value={weeks}>
                                    {weeks}
                                  </option>
                                ))}
                              </select>
                            ) : isEditing ? (
                              <Input
                                type="text"
                                value={editPoints}
                                aria-label={`Points for ${scoringMetric}`}
                                onChange={handleEditPointsChange}
                                className="w-24"
                              />
                            ) : (
                              score.pointsAwarded
                            )}
                          </td>
                          <td className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {isEditing ? (
                                <>
                                  <Button
                                    type="button"
                                    size="sm"
                                    loading={editSaving}
                                    disabled={editAsWeeks && editPoints <= 0}
                                    onClick={() => handleSaveEdit(score)}
                                  >
                                    Save
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="secondary"
                                    size="sm"
                                    disabled={editSaving}
                                    onClick={handleCancelEdit}
                                  >
                                    Cancel
                                  </Button>
                                </>
                              ) : (
                                <>
                                  {isEditableScore(score) && (
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      aria-label={`Edit ${scoringMetric}`}
                                      onClick={() => handleStartEdit(score)}
                                    >
                                      Edit
                                    </Button>
                                  )}
                                  <DeleteMetric
                                    scoringId={score.scoringId}
                                    label={scoringMetric}
                                  />
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr className="border-t-2 border-letterboxd-border">
                      <td className="type-h2">Total points:</td>
                      <td className="type-h2" colSpan={2}>
                        {totalPoints}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MFLAdmin;
