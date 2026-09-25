import { useState, useEffect } from "react";
import { apiService } from "../services/api";
import type { MFLLeaderboardEntry } from "../types";

export const useMflLeaderboard = () => {
  const [official, setOfficial] = useState<MFLLeaderboardEntry[]>([]);
  const [all, setAll] = useState<MFLLeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError(null);

    async function fetchLeaderboard() {
      try {
        const response = await apiService.getMflLeaderboard(ac.signal);
        if (response.data) {
          setOfficial(response.data.official);
          setAll(response.data.all);
        }
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setError("Failed to load standings");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }

    fetchLeaderboard();

    return () => ac.abort();
  }, []);

  return { official, all, loading, error };
};
