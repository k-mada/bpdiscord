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
import type { CurrentUser } from "../types";

const TOKEN_KEY = "token";
// Legacy cached-identity blob, superseded by the /me-resolved CurrentUser.
// Cleared on logout so a stale copy can't linger and mislead any straggler.
const LEGACY_USER_KEY = "user";

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
  const [token, setToken] = useState<string | null>(() =>
    localStorage.getItem(TOKEN_KEY),
  );
  const [user, setUser] = useState<CurrentUser | null>(null);
  // Start in loading only if there's a token to resolve; no token → settled.
  const [loading, setLoading] = useState<boolean>(
    () => !!localStorage.getItem(TOKEN_KEY),
  );
  const [error, setError] = useState<string | null>(null);

  // Resolve identity from /me whenever the token changes. Cross-tab token
  // writes flip `token` via the storage listener below, re-running this.
  // A failed /me (e.g. expired token) sets user=null but intentionally leaves
  // the token in place — parity with the old useUser; the next authed request
  // surfaces the 401 rather than this provider force-redirecting.
  useEffect(() => {
    if (!token) {
      setUser(null);
      setError(null);
      setLoading(false);
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
        setUser(null);
        setError("Failed to load current user");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadCurrentUser();
    return () => controller.abort();
  }, [token]);

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
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(LEGACY_USER_KEY);
    setToken(null);
  }, []);

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
