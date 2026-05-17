import { useState, useEffect, useCallback } from "react";
import { apiService } from "../services/api";

type RatingsDistribution = Array<{ rating: number; count: number }>;

export const useRatingsDistribution = () => {
  const [data, setData] = useState<RatingsDistribution>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getRatingsDistribution();
      if (response.data) setData(response.data);
    } catch {
      setError("Failed to load ratings distribution");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};
