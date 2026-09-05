import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MFLMovieScore } from "../../types";
import Spinner from "../Spinner";
import apiService from "../../services/api";
import { useMflData } from "../../hooks/useMflData";
import { formatReleaseDate } from "../../utilities";

function metricLabel(score: MFLMovieScore): string {
  if (score.metricName === "gross" || score.metricName === "rank") {
    return `${score.metricName} ${score.category}`;
  }
  return `${score.metricName} - ${score.category} (${score.scoringCondition})`;
}

const FilmBreakdown = () => {
  const { filmSlug } = useParams<{ filmSlug: string }>();
  const { movies, loading: catalogueLoading } = useMflData();
  const [scores, setScores] = useState<MFLMovieScore[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!filmSlug) return;
    const controller = new AbortController();

    async function loadScores(slug: string) {
      setLoading(true);
      setError(null);
      try {
        const response = await apiService.getMflMovieScore(
          slug,
          controller.signal,
        );
        setScores(response.data ?? []);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError("Failed to load this film's score breakdown");
      } finally {
        setLoading(false);
      }
    }

    loadScores(filmSlug);
    return () => controller.abort();
  }, [filmSlug]);

  const film = movies.find((movie) => movie.filmSlug === filmSlug);
  const busy = loading || catalogueLoading;

  const sorted = [...scores].sort((a, b) =>
    a.metricName.localeCompare(b.metricName),
  );
  const totalPoints = sorted.reduce(
    (total, score) => total + score.pointsAwarded,
    0,
  );

  return (
    <div>
      <p className="text-letterboxd-text-secondary mb-4">
        <Link to="/mfl" className="underline hover:no-underline">
          Back to eligible films
        </Link>
      </p>

      <h2 className="text-xl font-bold text-letterboxd-text-primary mb-2">
        {film ? film.title : "Score breakdown"}
      </h2>

      {busy && <Spinner />}

      {!busy && error && (
        <p className="text-letterboxd-text-secondary">{error}</p>
      )}

      {!busy && !error && film && (
        <p className="text-letterboxd-text-secondary mb-6">
          {film.releaseDate
            ? formatReleaseDate(film.releaseDate)
            : "Release date unknown"}
          {" · "}
          {film.price === null ? "No price" : `$${film.price}`}
        </p>
      )}

      {!busy && !error && sorted.length === 0 && (
        <p className="text-letterboxd-text-secondary">
          This film has not scored yet.
        </p>
      )}

      {!busy && !error && sorted.length > 0 && (
        <table className="data-table">
          <thead>
            <tr>
              <th scope="col">Scoring metric</th>
              <th scope="col">Points awarded</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((score) => (
              <tr key={score.scoringId}>
                <td>{metricLabel(score)}</td>
                <td>{score.pointsAwarded}</td>
              </tr>
            ))}
            <tr className="border-t-2 border-letterboxd-border">
              <td className="font-bold text-xl">Total points:</td>
              <td className="font-bold text-xl">{totalPoints}</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
};

export default FilmBreakdown;
