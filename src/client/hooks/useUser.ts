import { useState, useEffect } from "react";
import { apiService } from "../services/api";
import type { CurrentUser } from "../types";

// Dispatched after the auth token is written/cleared in localStorage so
// same-tab listeners (useUser) re-sync immediately — the native "storage"
// event only fires in *other* tabs. Login/signup/logout emit this.
export const AUTH_CHANGE_EVENT = "authchange";

export const emitAuthChange = () => {
  window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
};

// Resolves the logged-in account's identity (including its claimed
// lbusername) from GET /api/auth/me. Returns null when there's no token, or
// when the token is rejected — callers treat that as "logged out". Re-syncs
// on login/logout (same tab via AUTH_CHANGE_EVENT, other tabs via "storage").
export const useUser = () => {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ac: AbortController | null = null;

    async function load() {
      ac?.abort();
      const token = localStorage.getItem("token");
      if (!token) {
        setUser(null);
        setError(null);
        setLoading(false);
        return;
      }

      const controller = new AbortController();
      ac = controller;
      setLoading(true);
      setError(null);

      try {
        const response = await apiService.getCurrentUser(
          token,
          controller.signal,
        );
        // A 2xx is authoritative: if it somehow carries no user, the truth is
        // "no user", not the previously-cached one. (Real auth failures throw
        // and are handled below.)
        setUser(response.data ?? null);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        setUser(null);
        setError("Failed to load current user");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    // Other tabs only signal via "storage"; ignore writes to unrelated keys.
    // e.key is null when the whole store is cleared.
    const onStorage = (e: StorageEvent) => {
      if (e.key === "token" || e.key === null) load();
    };

    load();

    window.addEventListener(AUTH_CHANGE_EVENT, load);
    window.addEventListener("storage", onStorage);
    return () => {
      ac?.abort();
      window.removeEventListener(AUTH_CHANGE_EVENT, load);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  return { user, loading, error };
};
