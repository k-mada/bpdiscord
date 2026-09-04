import { useState, useEffect, useCallback } from "react";
import { apiService } from "../services/api";
import { MFLScoringMetric, MFLMovieScore, MFLCatalogueFilm } from "../types";

export const useMflData = () => {
  const [scoringMetrics, setScoringMetrics] = useState<MFLScoringMetric[]>([]);
  const [movies, setMovies] = useState<MFLCatalogueFilm[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    try {
      const response = await apiService.getMflScoringMetrics();
      if (response.data) setScoringMetrics(response.data);
    } catch {
      setError("Failed to load scoring metrics");
    }
  }, []);

  const fetchMovies = useCallback(async () => {
    try {
      const response = await apiService.getMflMovies();
      if (response.data) setMovies(response.data);
    } catch {
      setError("Failed to load movies");
    }
  }, []);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([fetchMetrics(), fetchMovies()]);
    } finally {
      setLoading(false);
    }
  }, [fetchMetrics, fetchMovies]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const getMovieScore = async (filmSlug: string): Promise<MFLMovieScore[]> => {
    const response = await apiService.getMflMovieScore(filmSlug);
    return response.data ?? [];
  };

  // Token is a parameter rather than read from useAuth here: three PUBLIC
  // components consume this hook and must not be coupled to auth.
  const upsertMovieScore = async (
    data: {
      filmSlug: string;
      pointsAwarded: number;
      metricId: number;
      scoringId?: number;
    },
    token: string
  ) => {
    return apiService.upsertMflMovieScore(data, token);
  };

  const deleteScore = async (scoringId: number, token: string) => {
    return apiService.deleteMflMovieScore(scoringId, token);
  };

  return {
    scoringMetrics,
    movies,
    loading,
    error,
    refetch: fetchAll,
    refetchMetrics: fetchMetrics,
    refetchMovies: fetchMovies,
    getMovieScore,
    upsertMovieScore,
    deleteScore,
  };
};
