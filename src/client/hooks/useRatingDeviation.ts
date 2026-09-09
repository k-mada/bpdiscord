import { useState, useEffect } from "react";
import { apiService } from "../services/api";
import type { RatingDeviationFilm } from "../../shared/types";

type Extremes = { over: RatingDeviationFilm[]; under: RatingDeviationFilm[] };

const EMPTY: Extremes = { over: [], under: [] };

/**
 * Films our users rate furthest above / below the Letterboxd average for a
 * release year. Pass `null` for all-time (no year filter). Keeps the previous
 * results visible while a new year loads so the section doesn't flash empty.
 */
export const useRatingDeviation = (year: number | null) => {
  const [data, setData] = useState<Extremes>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);

    async function fetchDeviation() {
      try {
        const response = await apiService.getRatingDeviation(
          year ?? undefined,
          ac.signal,
        );
        // The controller returns 200 { success:false } (no data) on DB error,
        // so a failure won't throw — guard on the payload, not just try/catch.
        if (!response.data) {
          throw new Error(response.error ?? "Request failed");
        }
        setData({ over: response.data.over, under: response.data.under });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Failed to load rating deviation");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }

    fetchDeviation();

    return () => ac.abort();
  }, [year]);

  return { ...data, loading, error };
};
