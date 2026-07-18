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

  const getUserComplete = useCallback(async (username: string) => {
    const response = await apiService.getFilmUserComplete(username);
    return response.data;
  }, []);

  return {
    usernames,
    loading,
    error,
    refetch: fetchUsernames,
    getUserComplete,
  };
};
