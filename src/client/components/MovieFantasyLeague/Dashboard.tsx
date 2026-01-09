import { useEffect, useState } from "react";
import apiService from "../../services/api";
import { MFLMovieScore } from "../../types";
import Spinner from "../Spinner";
import MovieSelector from "./MovieSelector";

const MovieFantasyLeague = () => {
  const [movieScores, setMovieScores] = useState<MFLMovieScore[]>([]);
  const [movies, setMovies] = useState<{ title: string; filmSlug: string }[]>(
    []
  );
  const [selectedMovie, setSelectedMovie] = useState("");
  const [totalPoints, setTotalPoints] = useState(0);
  const [loading, setLoading] = useState(true);

  const getMflData = async () => {
    try {
      setLoading(true);

      const totalMflData = await Promise.all([
        apiService.getMflScoringMetrics(),
        apiService.getMflMovies(),
      ]);

      if (totalMflData) {
        const movies = totalMflData[1].data || [];
        setMovies(movies);
      }
    } catch (err) {
      console.error("Error fetching MFL scoring metrics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getMflData();
  }, []);

  function handleMovieSelect(filmSlug: string) {
    setLoading(true);
    if (filmSlug !== "-1") {
      apiService.getMflMovieScore(filmSlug).then((response) => {
        if (response.data) {
          const totalPoints = response.data.reduce(
            (acc, curr) => acc + curr.pointsAwarded,
            0
          );
          setSelectedMovie(filmSlug);
          setTotalPoints(totalPoints);

          const sortedMovieScores = response.data.sort((a, b) => {
            if (a.metricName < b.metricName) {
              return -1;
            }
            if (a.metricName > b.metricName) {
              return 1;
            }
            return 0;
          });

          setMovieScores(sortedMovieScores);
          setLoading(false);
        }
      });
    }
  }

  return (
    <div>
      <h2 className="text-xl font-bold text-letterboxd-text-primary mb-4">
        Select a movie to view its MFL score breakdown
      </h2>
      <p className="text-letterboxd-text-secondary mb-4">
        <a
          href="/mfl/scoring-reference"
          className="underline hover:no-underline"
        >
          Scoring reference
        </a>
      </p>
      <MovieSelector movies={movies} onMovieSelect={handleMovieSelect} />
      {loading && <Spinner />}
      {selectedMovie !== "-1" && movieScores.length === 0 && (
        <h3 className="text-l font-bold text-letterboxd-text-primary my-4">
          Total points: 0
        </h3>
      )}
      {!loading && movieScores.length > 0 && (
        <div className="flex flex-col gap-2">
          <table className="data-table">
            <thead>
              <tr>
                <th>Scoring Metric</th>
                <th>Points Awarded</th>
              </tr>
            </thead>
            <tbody>
              {movieScores.map((movieScore, id) => {
                let scoringMetric = "";
                if (
                  movieScore.metricName === "gross" ||
                  movieScore.metricName === "rank"
                ) {
                  scoringMetric = `${movieScore.metricName} ${movieScore.category}`;
                } else {
                  scoringMetric = `${movieScore.metricName}  -${movieScore.category} (${movieScore.scoringCondition})`;
                }
                return (
                  <tr key={id}>
                    <td>{scoringMetric}</td>
                    <td>{movieScore.pointsAwarded}</td>
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

export default MovieFantasyLeague;
