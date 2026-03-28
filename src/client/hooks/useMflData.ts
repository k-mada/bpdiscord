import { useState, useEffect, useCallback } from "react";
import { apiService } from "../services/api";
import { MFLScoringMetric, MFLMovieScore } from "../types";

export const useMflData = () => {
  const [scoringMetrics, setScoringMetrics] = useState<MFLScoringMetric[]>([]);
  const [movies, setMovies] = useState<{ title: string; filmSlug: string }[]>([]);
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

  const upsertMovieScore = async (
    filmSlug: string,
    pointsAwarded: number,
    metricId: number,
    scoringId?: number
  ) => {
    return apiService.upsertMflMovieScore(filmSlug, pointsAwarded, metricId, scoringId);
  };

  const deleteScore = async (scoringId: number) => {
    return apiService.deleteMflScoringMetric(scoringId);
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
