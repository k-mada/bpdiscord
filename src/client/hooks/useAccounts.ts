import { useCallback, useEffect, useRef, useState } from "react";

import { apiService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import type {
  AdminUserRow,
  AccountUpdateRequest,
  AccountUpdateResponse,
  ProfileCreateRequest,
  ProfileMutationResponse,
  ProfileUpdateRequest,
} from "../types";

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
  const { token } = useAuth();
  // Ref keeps the callbacks below identity-stable while still reading the
  // latest token, so the mount fetch doesn't re-fire on every token change.
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const [data, setData] = useState<AdminUserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const token = tokenRef.current;
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
      const token = tokenRef.current;
      if (!token) throw new Error("Not authenticated");
      const response = await apiService.updateAccount(id, patch, token);
      const updated = response.data;
      if (!updated) throw new Error("Server did not return updated account");
      // Spliced in to avoid a full refetch. requiresReauth is transport-only,
      // not part of AccountView, so it's stripped before storing.
      const { requiresReauth: _ignored, ...row } = updated;
      void _ignored;
      setData((prev) =>
        prev.map((a) => (a.kind === "account" && a.id === id ? row : a)),
      );
      // A link change moves a username between an account and a profile row;
      // reload so no stale profile row is left to edit or delete.
      if (patch.lbusername !== undefined) {
        try {
          const fresh = await apiService.getAccounts(token);
          if (fresh.data) setData(fresh.data);
        } catch {
          // The patched list stays; a page reload recovers.
        }
      }
      return updated;
    },
    [],
  );

  const remove = useCallback(async (id: string): Promise<void> => {
    const token = tokenRef.current;
    if (!token) throw new Error("Not authenticated");
    await apiService.deleteAccount(id, token);
    setData((prev) => prev.filter((a) => a.kind !== "account" || a.id !== id));
  }, []);

  const createProfile = useCallback(
    async (body: ProfileCreateRequest): Promise<ProfileMutationResponse> => {
      const token = tokenRef.current;
      if (!token) throw new Error("Not authenticated");
      const response = await apiService.createProfile(body, token);
      const result = response.data;
      if (!result) throw new Error("Server did not return the new profile");
      setData((prev) => [result.profile, ...prev]);
      return result;
    },
    [],
  );

  const updateProfile = useCallback(
    async (
      lbusername: string,
      patch: ProfileUpdateRequest,
    ): Promise<ProfileMutationResponse> => {
      const token = tokenRef.current;
      if (!token) throw new Error("Not authenticated");
      const response = await apiService.updateProfile(lbusername, patch, token);
      const result = response.data;
      if (!result) throw new Error("Server did not return the updated profile");
      setData((prev) =>
        prev.map((a) =>
          a.kind === "profile" && a.lbusername === lbusername ? result.profile : a,
        ),
      );
      return result;
    },
    [],
  );

  const removeProfile = useCallback(async (lbusername: string): Promise<void> => {
    const token = tokenRef.current;
    if (!token) throw new Error("Not authenticated");
    await apiService.deleteProfile(lbusername, token);
    setData((prev) =>
      prev.filter((a) => a.kind !== "profile" || a.lbusername !== lbusername),
    );
  }, []);

  return {
    data,
    loading,
    error,
    refetch,
    update,
    remove,
    createProfile,
    updateProfile,
    removeProfile,
  };
};
