import { useState, useEffect } from "react";
import { apiService } from "../services/api";
import type { MoviesInCommonData } from "../types";

// Fetches the set of films two users have both logged, plus their per-film
// ratings (the input the taste-compatibility widget derives everything from).
// No-ops until both usernames are set and distinct. Aborts in-flight requests
// on change/unmount.
export const useMoviesInCommon = (
  user1: string | null,
  user2: string | null,
) => {
  const [data, setData] = useState<MoviesInCommonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user1 || !user2 || user1 === user2) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);

    async function fetchMoviesInCommon() {
      try {
        const response = await apiService.getMoviesInCommon(
          user1!,
          user2!,
          ac.signal,
        );
        if (response.data) setData(response.data);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Failed to load movies in common");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }

    fetchMoviesInCommon();

    return () => ac.abort();
  }, [user1, user2]);

  return { data, loading, error };
};
