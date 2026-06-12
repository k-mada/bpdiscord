import { useState, useEffect } from "react";
import { apiService } from "../services/api";
import type { CompatibilityExtremesData } from "../types";

export const useCompatibilityExtremes = (username: string | null) => {
  const [data, setData] = useState<CompatibilityExtremesData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    setError(null);
    setData(null);

    async function fetchExtremes() {
      try {
        const response = await apiService.getCompatibilityExtremes(
          username!,
          ac.signal,
        );
        if (response.data) setData(response.data);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Failed to load compatibility extremes");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }

    fetchExtremes();

    return () => ac.abort();
  }, [username]);

  return { data, loading, error };
};
