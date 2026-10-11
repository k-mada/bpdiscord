import { useState, useEffect } from "react";
import { apiService } from "../services/api";

/**
 * Distinct films watched by the Discord. Pass `null` for all-time, or a release
 * year to scope the count. `data` is null until the first result arrives, so a
 * reload on year change can keep the previous number visible instead of
 * flashing a spinner.
 */
export const useUserFilmsCount = (year: number | null) => {
  const [data, setData] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);

    async function fetchCount() {
      try {
        const response = await apiService.getUserFilmsCount(
          year ?? undefined,
          ac.signal,
        );
        if (response.data !== undefined) setData(response.data);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Failed to load user films count");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }

    fetchCount();

    return () => ac.abort();
  }, [year]);

  return { data, loading, error };
};
