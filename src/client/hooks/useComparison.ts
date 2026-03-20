import { useState, useEffect, useCallback } from "react";
import { apiService } from "../services/api";

export const useComparison = () => {
  const [usernames, setUsernames] = useState<
    Array<{ username: string; displayName?: string }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchUsernames = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getFilmUsers();
      if (response.data) setUsernames(response.data);
    } catch {
      setError("Failed to load users");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchUsernames();
  }, [fetchUsernames]);

  const getUserComplete = async (username: string, fallback: boolean = true) => {
    const response = await apiService.getFilmUserComplete(username, fallback);
    return response.data;
  };

  const getMoviesInCommon = async (user1: string, user2: string) => {
    const response = await apiService.getMoviesInCommon(user1, user2);
    return response.data;
  };

  return {
    usernames,
    loading,
    error,
    refetch: fetchUsernames,
    getUserComplete,
    getMoviesInCommon,
  };
};
