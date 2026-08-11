import { useState, useEffect } from "react";
import { apiService } from "../services/api";
import { ApiError } from "../lib/apiError";
import type { FilmDetail } from "../types";

export const useFilmDetail = (
  filmSlug: string | null,
  includeNonDiscord = false,
) => {
  const [data, setData] = useState<FilmDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!filmSlug) {
      setData(null);
      setError(null);
      setNotFound(false);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    setError(null);
    setNotFound(false);
    setData(null);

    async function fetchFilmDetail() {
      try {
        const response = await apiService.getFilmDetail(
          filmSlug!,
          { includeNonDiscord },
          ac.signal,
        );
        if (response.data) setData(response.data);
        else setError("Failed to load film");
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError("Failed to load film");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }

    fetchFilmDetail();

    return () => ac.abort();
  }, [filmSlug, includeNonDiscord]);

  return { data, loading, error, notFound };
};
