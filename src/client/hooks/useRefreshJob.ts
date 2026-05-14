import { useCallback } from "react";

import { apiService } from "../services/api";
import type { RefreshJob } from "../types";
import { useJob } from "./useJob";

const ACTIVE_JOB_KEY = "activeRefreshJobId";
const getToken = (): string | null => localStorage.getItem("token");

/**
 * Owns the admin's active Hater Rankings bulk refresh job. Thin wrapper
 * over the generic useJob hook — domain-specific concerns (API binding,
 * placeholder shape) live here; lifecycle/polling/retry live in useJob.
 */
export const useRefreshJob = () => {
  const { job, error, isTriggering, isCancelling, trigger, cancel } = useJob<
    RefreshJob,
    void
  >({
    trigger: async () => {
      const token = getToken();
      if (!token) throw new Error("Not authenticated");
      const res = await apiService.triggerRefresh(token);
      const jobId = res.data?.job_id;
      if (!jobId) throw new Error("Server did not return a job id");
      return jobId;
    },
    poll: async (jobId) => {
      const token = getToken();
      if (!token) throw new Error("Not authenticated");
      const res = await apiService.getRefreshJob(jobId, token);
      return res.data ?? null;
    },
    cancel: async (jobId) => {
      const token = getToken();
      if (!token) throw new Error("Not authenticated");
      await apiService.cancelRefreshJob(jobId, token);
    },
    storageKey: ACTIVE_JOB_KEY,
    placeholder: (jobId) => {
      const now = new Date().toISOString();
      return {
        id: jobId,
        status: "running",
        startedAt: now,
        finishedAt: null,
        startedBy: "",
        phase: null,
        progress: {},
        errors: [],
        logTail: "",
        updatedAt: now,
      };
    },
  });

  // Bulk path's trigger takes no argument — wrap the generic's
  // trigger(arg: void) to a thunk so existing callers can keep saying
  // `await trigger()` without an explicit `undefined`.
  const triggerNoArg = useCallback(() => trigger(undefined as void), [trigger]);

  return {
    job,
    error,
    isTriggering,
    isCancelling,
    trigger: triggerNoArg,
    cancel,
  };
};
