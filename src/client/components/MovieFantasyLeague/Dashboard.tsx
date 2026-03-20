import { useState } from "react";
import { MFLMovieScore } from "../../types";
import Spinner from "../Spinner";
import MovieSelector from "./MovieSelector";
import { useMflData } from "../../hooks/useMflData";

const MovieFantasyLeague = () => {
  const { movies, loading: initialLoading, getMovieScore } = useMflData();
  const [movieScores, setMovieScores] = useState<MFLMovieScore[]>([]);
  const [selectedMovie, setSelectedMovie] = useState("");
  const [totalPoints, setTotalPoints] = useState(0);
  const [scoreLoading, setScoreLoading] = useState(false);

  async function handleMovieSelect(filmSlug: string) {
    if (filmSlug !== "-1") {
      setScoreLoading(true);
      const scores = await getMovieScore(filmSlug);
      const totalPoints = scores.reduce(
        (acc, curr) => acc + curr.pointsAwarded,
        0
      );
      setSelectedMovie(filmSlug);
      setTotalPoints(totalPoints);

      const sortedMovieScores = scores.sort((a, b) => {
        if (a.metricName < b.metricName) return -1;
        if (a.metricName > b.metricName) return 1;
        return 0;
      });

      setMovieScores(sortedMovieScores);
      setScoreLoading(false);
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
      {(initialLoading || scoreLoading) && <Spinner />}
      {selectedMovie !== "-1" && movieScores.length === 0 && (
        <h3 className="text-l font-bold text-letterboxd-text-primary my-4">
          Total points: 0
        </h3>
      )}
      {!scoreLoading && movieScores.length > 0 && (
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
