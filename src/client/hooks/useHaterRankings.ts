import { useState, useEffect, useCallback } from "react";
import { apiService } from "../services/api";
import { HaterRanking } from "../types";

export interface HaterRanking2 {
  displayName: string;
  username: string;
  filmsRated: number;
  differential: number;
  adjustedDifferential: number;
}

export const useHaterRankings = () => {
  const [rankings, setRankings] = useState<HaterRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRankings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getHaterRankings();
      if (response.data) setRankings(response.data);
    } catch {
      setError("Failed to load hater rankings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  return { rankings, loading, error, refetch: fetchRankings };
};

export const useHaterRankings2 = () => {
  const [rankings, setRankings] = useState<HaterRanking2[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRankings = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getHaterRankings2();
      if (response.data) setRankings(response.data);
    } catch {
      setError("Failed to load hater rankings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRankings();
  }, [fetchRankings]);

  return { rankings, loading, error, refetch: fetchRankings };
};
