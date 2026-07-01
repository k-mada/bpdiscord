import { useState, useEffect } from "react";
import { apiService } from "../services/api";
import type { MovieSwapResult } from "../../shared/types";

// Bidirectional movie swap for two users — films each rated that the other hasn't
// seen. No-ops until both usernames are set + distinct; aborts on change/unmount.
export const useMovieSwap = (userA: string | null, userB: string | null) => {
  const [data, setData] = useState<MovieSwapResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userA || !userB || userA === userB) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);

    async function fetchMovieSwap() {
      try {
        const response = await apiService.getMovieSwap(userA!, userB!, ac.signal);
        if (response.data) setData(response.data);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Failed to load movie swap");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }

    fetchMovieSwap();

    return () => ac.abort();
  }, [userA, userB]);

  return { data, loading, error };
};
