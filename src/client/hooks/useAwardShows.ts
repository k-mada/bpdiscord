import { useState, useEffect, useCallback } from "react";
import { apiService } from "../services/api";
import { AwardShow } from "../types";

export const useAwardShows = () => {
  const [awardShows, setAwardShows] = useState<AwardShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAwardShows = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getAwardShows();
      setAwardShows(response.data ?? []);
    } catch {
      setError("Failed to load award shows");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAwardShows();
  }, [fetchAwardShows]);

  const createAwardShow = async (
    data: { name: string; slug: string; description?: string },
    token: string
  ): Promise<AwardShow | undefined> => {
    const response = await apiService.createAwardShow(data, token);
    // Refresh the list after successful creation
    await fetchAwardShows();
    return response.data;
  };

  return { awardShows, loading, error, refetch: fetchAwardShows, createAwardShow };
};
