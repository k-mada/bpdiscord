import { useState, useEffect } from "react";
import { apiService } from "../services/api";
import type { LBFilm } from "../types";

type TopFilms = { topRated: LBFilm[]; topWatched: LBFilm[] };

const EMPTY: TopFilms = { topRated: [], topWatched: [] };

/**
 * Top rated + top watched films for a release year. Pass `null` for all-time
 * (no year filter). Keeps the previous results visible while a new year loads
 * so the lists don't flash empty on change.
 */
export const useTopFilmsByYear = (year: number | null) => {
  const [data, setData] = useState<TopFilms>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);

    async function fetchTopFilms() {
      try {
        const response = await apiService.getTopFilmsByYear(
          year ?? undefined,
          ac.signal,
        );
        // The controller returns 200 { success:false } (no data) on DB error,
        // so a failure won't throw — guard on the payload, not just try/catch.
        if (!response.data) {
          throw new Error(response.error ?? "Request failed");
        }
        setData({
          topRated: response.data.topRated,
          topWatched: response.data.topWatched,
        });
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Failed to load top films");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }

    fetchTopFilms();

    return () => ac.abort();
  }, [year]);

  return { ...data, loading, error };
};
