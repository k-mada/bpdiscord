import { useEffect, useMemo, useState } from "react";
import apiService from "../../services/api";
import MovieSelector from "./MovieSelector";
import { MFLScoringMetric, MFLMovieScore } from "../../types";
import { Modal, ModalHeader, ModalBody } from "../Modal";
import Spinner from "../Spinner";

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
  const [movies, setMovies] = useState<{ title: string; filmSlug: string }[]>(
    [],
  );

  // list of scoring metrics for all movies
  const [scoringMetrics, setScoringMetrics] = useState<MFLScoringMetric[]>([]);
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
  const customizableMetricIds = [1, 10, 338];

  const getMflMovies = async () => {
    const response = await apiService.getMflMovies();
    if (response.data) {
      setMovies(response.data);
    }
  };

  const getMflMetrics = async () => {
    const response = await apiService.getMflScoringMetrics();
    if (response.data) {
      const sortedScoringMetrics = response.data.sort((a, b) => {
        if (a.metricName < b.metricName) {
          return -1;
        }
        if (a.metricName > b.metricName) {
          return 1;
        }
        return 0;
      });
      setScoringMetrics(sortedScoringMetrics);
    }
  };

  const handleMetricSelect = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const metricId = parseInt(event.target.value);

    const selectedMetric = getMetricById(scoringMetrics, metricId);
    if (selectedMetric) {
      setSelectedMetric(selectedMetric);
      console.log("selecing metric", selectedMetric);
      setInputPointsAwarded(selectedMetric.pointValue);
      if (customizableMetricIds.includes(selectedMetric.metricId)) {
        setDisableScoreInput(false);
      } else {
        setDisableScoreInput(true);
      }
    }
  };

  useEffect(() => {
    getMflMovies();
    getMflMetrics();
  }, []);

  const resetForm = () => {
    setSelectedScoringId(0);
    setInputPointsAwarded(0);
    // setSelectedMetric(null);
    setDisableScoreInput(true);
  };

  const getMflMovieScore = async (filmSlug: string) => {
    const movieScores = await apiService.getMflMovieScore(filmSlug);
    if (movieScores.data) {
      return movieScores.data;
    }
    return [];
  };

  const handleMovieSelect = async (filmSlug: string) => {
    setLoading(true);
    if (filmSlug !== "-1") {
      const selectedMovieScore = await getMflMovieScore(filmSlug);
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
        setLoading(false);
      }
    }
  };

  const movieTitle = useMemo(() => {
    return movies.find((movie) => movie.filmSlug === movieScore[0]?.filmSlug)
      ?.title;
  }, [movieScore]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (selectedMetric?.metricId) {
      const existingScore = getMovieScoreByMetricId(
        movieScore,
        selectedMetric?.metricId,
      );

      console.log("existingScore", existingScore);
      // const metric = getMetricById(scoringMetrics, selectedMetric.metricId);

      let response;
      if (existingScore && selectedScoringId > 0) {
        console.log("updating existing score", existingScore);
        response = await apiService.upsertMflMovieScore(
          existingScore.filmSlug,
          inputPointsAwarded,
          selectedMetric.metricId,
          existingScore.scoringId,
        );
      } else {
        console.log("creating new score");
        response = await apiService.upsertMflMovieScore(
          currentSelectedMovie,
          inputPointsAwarded,
          selectedMetric.metricId,
        );
      }

      // Only refresh if the API call was successful
      if (!response.error && currentSelectedMovie) {
        resetForm();
        const refreshedMovieScore =
          await getMflMovieScore(currentSelectedMovie);
        if (refreshedMovieScore) {
          const totalPoints = refreshedMovieScore.reduce(
            (acc, curr) => acc + curr.pointsAwarded,
            0,
          );
          setTotalPoints(totalPoints);
          setMovieScore(refreshedMovieScore);
        }
      }
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
        console.log("score!", score);
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
    setIsModalOpen(false);
  };

  const handleDeleteMetric = (scoringId: number) => {
    setSelectedScoringId(scoringId);
    setIsModalOpen(true);
  };

  const handleConfirmDeleteMetric = async () => {
    if (selectedScoringId > 0) {
      const response =
        await apiService.deleteMflScoringMetric(selectedScoringId);
      if (response.error) {
        console.error("Error deleting metric", response.error);
      } else {
        console.log("Metric deleted successfully");
        // Refresh the movie score data after successful deletion
        if (currentSelectedMovie) {
          const refreshedMovieScore =
            await getMflMovieScore(currentSelectedMovie);
          if (refreshedMovieScore) {
            const totalPoints = refreshedMovieScore.reduce(
              (acc, curr) => acc + curr.pointsAwarded,
              0,
            );
            setTotalPoints(totalPoints);
            setMovieScore(refreshedMovieScore);
          }
        }
      }
    }
    setIsModalOpen(false);
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

  return (
    <div>
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <ModalHeader onClose={handleClose}>
          Are you sure you want to delete this metric?
        </ModalHeader>
        <ModalBody>
          <p>This action cannot be undone.</p>
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
                let scoringMetric = "";
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
