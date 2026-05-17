import { useState, useEffect, useCallback } from "react";
import { apiService } from "../services/api";

export const useUserFilmsCount = () => {
  const [data, setData] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getUserFilmsCount();
      if (response.data !== undefined) setData(response.data);
    } catch {
      setError("Failed to load user films count");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
};
