import { useEffect, useMemo, useState } from "react";

import { apiService } from "../services/api";
import type { AccountView } from "../types";

/**
 * Derives the set of Letterboxd usernames not yet linked to any app account,
 * for the admin edit modal's autocomplete. Sourced from
 * GET /api/film-users (all Users.lbusername rows) minus the lbusernames
 * already present in `accounts` (passed in to avoid a second admin fetch).
 *
 * `currentLbusername` is included in the output even if it's "claimed" —
 * because the row being edited owns that name, so it should remain a valid
 * choice in the modal's dropdown.
 */
export const useUnclaimedLbUsernames = (
  accounts: AccountView[],
  currentLbusername: string | null = null,
) => {
  const [allLbusernames, setAllLbusernames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await apiService.getFilmUsers();
        if (cancelled) return;
        const rows = response.data ?? [];
        setAllLbusernames(rows.map((r) => r.username));
      } catch (e) {
        if (cancelled) return;
        setError(
          e instanceof Error
            ? e.message
            : "Failed to load Letterboxd usernames",
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const unclaimed = useMemo(() => {
    const claimed = new Set(
      accounts
        .map((a) => a.lbusername)
        .filter((u): u is string => typeof u === "string" && u.length > 0),
    );
    return allLbusernames
      .filter((u) => !claimed.has(u) || u === currentLbusername)
      .sort();
  }, [allLbusernames, accounts, currentLbusername]);

  return { data: unclaimed, loading, error };
};
