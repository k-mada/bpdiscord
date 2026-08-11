import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiService } from "../services/api";
import { ApiError } from "../lib/apiError";
import { isJwtExpired } from "../lib/jwt";
import type { CurrentUser } from "../types";

const TOKEN_KEY = "token";
// Legacy cached-identity blob, superseded by the /me-resolved CurrentUser.
// Cleared on logout so a stale copy can't linger and mislead any straggler.
const LEGACY_USER_KEY = "user";

// Treats a locally-expired token as absent so the UI never boots into a
// logged-in state for a dead token. Idempotent — safe in a lazy initializer.
function readLiveStoredToken(): string | null {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (!stored) return null;
  if (isJwtExpired(stored)) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
    return null;
  }
  return stored;
}

interface AuthContextValue {
  token: string | null;
  user: CurrentUser | null;
  loading: boolean;
  error: string | null;
  // Persist the JWT and resolve the account identity from /me. Same-tab
  // consumers update via React; other tabs via the "storage" listener.
  login: (token: string) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Single source of truth for client auth: owns the JWT + the /me-resolved
 * CurrentUser and exposes login()/logout(). Replaces the scattered
 * localStorage.getItem("token") reads and the standalone useUser hook.
 */
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [token, setToken] = useState<string | null>(readLiveStoredToken);
  const [user, setUser] = useState<CurrentUser | null>(null);
  // Start in loading only if there's a live token to resolve; no/expired
  // token → settled. readLiveStoredToken already dropped any expired token.
  const [loading, setLoading] = useState<boolean>(
    () => readLiveStoredToken() !== null,
  );
  const [error, setError] = useState<string | null>(null);

  const clearStoredAuth = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
    setToken(null);
  }, []);

  // Resolve identity from /me whenever the token changes. Cross-tab token
  // writes flip `token` via the storage listener below, re-running this.
  useEffect(() => {
    if (!token) {
      setUser(null);
      setError(null);
      setLoading(false);
      return;
    }

    // Clear without a doomed /me round-trip. A refresh-token attempt would
    // slot in here, falling through to the clear only on failure.
    if (isJwtExpired(token)) {
      clearStoredAuth();
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    async function loadCurrentUser() {
      try {
        const response = await apiService.getCurrentUser(
          token as string,
          controller.signal,
        );
        // A 2xx is authoritative: no user in the body means "no user", not the
        // previously-resolved one. Real auth failures throw and are caught.
        setUser(response.data ?? null);
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
        // Only a genuine auth rejection clears the session; network/5xx blips
        // keep the token so a transient outage doesn't log the user out.
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          clearStoredAuth();
          return;
        }
        setUser(null);
        setError("Failed to load current user");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadCurrentUser();
    return () => controller.abort();
  }, [token, clearStoredAuth]);

  // Other tabs only signal via "storage" (a context can't see another tab's
  // localStorage write). e.key is null when the whole store is cleared.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === TOKEN_KEY || e.key === null) {
        setToken(localStorage.getItem(TOKEN_KEY));
      }
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const login = useCallback((nextToken: string) => {
    localStorage.setItem(TOKEN_KEY, nextToken);
    setToken(nextToken);
  }, []);

  const logout = useCallback(() => {
    clearStoredAuth();
  }, [clearStoredAuth]);

  const value = useMemo(
    () => ({ token, user, loading, error, login, logout }),
    [token, user, loading, error, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
};
