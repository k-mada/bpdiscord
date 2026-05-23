import { useCallback, useEffect, useState } from "react";

import { apiService } from "../services/api";
import type {
  AccountView,
  AccountUpdateRequest,
  AccountUpdateResponse,
} from "../types";

const getToken = (): string | null => localStorage.getItem("token");

/**
 * Admin account list owner. Fetches GET /api/admin/users on mount and exposes
 * mutate helpers that patch the local list optimistically once the server
 * confirms the change.
 *
 * Errors from the mutate helpers are re-thrown so the caller (the modal) can
 * decide how to surface them — most importantly the 409 conflict on a
 * already-claimed lbusername, which the modal renders inline.
 */
export const useAccounts = () => {
  const [data, setData] = useState<AccountView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError("Not authenticated");
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const response = await apiService.getAccounts(token);
      setData(response.data ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  const update = useCallback(
    async (
      id: string,
      patch: AccountUpdateRequest,
    ): Promise<AccountUpdateResponse> => {
      const token = getToken();
      if (!token) throw new Error("Not authenticated");
      const response = await apiService.updateAccount(id, patch, token);
      const updated = response.data;
      if (!updated) throw new Error("Server did not return updated account");
      // Splice into the local list so the table reflects the change without a
      // full refetch. requiresReauth is a transport-only signal, not part of
      // AccountView, so we strip it before storing.
      const { requiresReauth: _ignored, ...row } = updated;
      void _ignored;
      setData((prev) => prev.map((a) => (a.id === id ? row : a)));
      return updated;
    },
    [],
  );

  const remove = useCallback(async (id: string): Promise<void> => {
    const token = getToken();
    if (!token) throw new Error("Not authenticated");
    await apiService.deleteAccount(id, token);
    setData((prev) => prev.filter((a) => a.id !== id));
  }, []);

  return { data, loading, error, refetch, update, remove };
};
