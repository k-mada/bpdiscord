import { useState, useEffect } from "react";
import { apiService } from "../services/api";
import type { CurrentUser } from "../types";

// Resolves the logged-in account's identity (including its claimed
// lbusername) from GET /api/auth/me. Returns null when there's no token,
// or when the token is rejected — callers treat that as "logged out".
export const useUser = () => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setUser(null);
      setError(null);
      setLoading(false);
      return;
    }

    const ac = new AbortController();
    setLoading(true);
    setError(null);

    async function fetchCurrentUser() {
      try {
        const response = await apiService.getCurrentUser(token!, ac.signal);
        if (response.data) setUser(response.data);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setUser(null);
        setError("Failed to load current user");
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }

    fetchCurrentUser();

    return () => ac.abort();
  }, []);

  return { user, loading, error };
};
