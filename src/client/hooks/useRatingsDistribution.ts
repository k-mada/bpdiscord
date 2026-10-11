import { useState, useEffect } from "react";
import { apiService } from "../services/api";

type RatingsDistribution = Array<{ rating: number; count: number }>;

/**
 * Rating distribution for the histogram. Pass `null` for all-time (no year
 * filter), or a release year to scope to ratings on films released that year.
 * Keeps the previous data visible while a new year loads.
 */
export const useRatingsDistribution = (year: number | null) => {
  const [data, setData] = useState<RatingsDistribution>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);

    async function fetchDistribution() {
      try {
        const response = await apiService.getRatingsDistribution(
          year ?? undefined,
          ac.signal,
        );
        if (response.data) setData(response.data);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Failed to load ratings distribution");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }

    fetchDistribution();

    return () => ac.abort();
  }, [year]);

  return { data, loading, error };
};
