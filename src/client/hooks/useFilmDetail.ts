import { useState, useEffect } from "react";
import { apiService } from "../services/api";
import { ApiError } from "../lib/apiError";
import type { FilmDetail } from "../../shared/types";

type Result = {
  data: FilmDetail | null;
  error: string | null;
  notFound: boolean;
};

const EMPTY: Result = { data: null, error: null, notFound: false };

export const useFilmDetail = (
  filmSlug: string | null,
  includeNonDiscord = false,
) => {
  const requestKey = filmSlug ? `${filmSlug}|${includeNonDiscord}` : null;
  const [settled, setSettled] = useState<{
    key: string;
    result: Result;
  } | null>(null);

  useEffect(() => {
    if (!requestKey || !filmSlug) return;

    const ac = new AbortController();

    async function fetchFilmDetail() {
      let result: Result;
      try {
        const response = await apiService.getFilmDetail(
          filmSlug!,
          { includeNonDiscord },
          ac.signal,
        );
        result = response.data
          ? { ...EMPTY, data: response.data }
          : { ...EMPTY, error: "Failed to load film" };
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        result =
          e instanceof ApiError && e.status === 404
            ? { ...EMPTY, notFound: true }
            : { ...EMPTY, error: "Failed to load film" };
      }
      if (!ac.signal.aborted) setSettled({ key: requestKey!, result });
    }

    fetchFilmDetail();

    return () => ac.abort();
  }, [requestKey, filmSlug, includeNonDiscord]);

  // Keying the result to its request makes "loading" derived rather than a
  // separate flag, so no render can show a stale film or a premature error.
  const current = settled?.key === requestKey ? settled.result : EMPTY;

  return {
    ...current,
    loading: requestKey !== null && settled?.key !== requestKey,
  };
};
