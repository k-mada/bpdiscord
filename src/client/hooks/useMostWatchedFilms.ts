import { useState, useEffect } from "react";
import { apiService } from "../services/api";
import type { LBFilm } from "../types";

/**
 * Every film watched by at least 40 Discord users, ordered most-watched first.
 */
export const useMostWatchedFilms = () => {
  const [films, setFilms] = useState<LBFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);

    async function fetchMostWatched() {
      try {
        const response = await apiService.getMostWatchedFilms(ac.signal);
        if (!response.data) {
          throw new Error(response.error ?? "Request failed");
        }
        setFilms(response.data);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Failed to load most watched films");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }

    fetchMostWatched();

    return () => ac.abort();
  }, []);

  return { films, loading, error };
};
