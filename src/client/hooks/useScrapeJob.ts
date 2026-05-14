import { apiService } from "../services/api";
import type { UserScrapeJob } from "../types";
import { useJob } from "./useJob";

const ACTIVE_JOB_KEY = "activeScrapeJobId";
const getToken = (): string | null => localStorage.getItem("token");

/**
 * Owns the active per-user /fetcher scrape job. Thin wrapper over the
 * generic useJob hook — same lifecycle/polling/retry as the bulk admin
 * refresh, just bound to /api/scrape-user routes and the UserScrapeJob
 * shape (carries lbusername).
 *
 * Trigger takes a Letterboxd username argument: `await trigger("alice")`.
 * Cancel takes no args — it cancels whatever job is currently tracked.
 */
export const useScrapeJob = () => {
  return useJob<UserScrapeJob, string>({
    trigger: async (lbusername) => {
      const token = getToken();
      if (!token) throw new Error("Not authenticated");
      const res = await apiService.triggerScrapeUser(lbusername, token);
      const jobId = res.data?.job_id;
      if (!jobId) throw new Error("Server did not return a job id");
      return jobId;
    },
    poll: async (jobId) => {
      const token = getToken();
      if (!token) throw new Error("Not authenticated");
      const res = await apiService.getScrapeJob(jobId, token);
      return res.data ?? null;
    },
    cancel: async (jobId) => {
      const token = getToken();
      if (!token) throw new Error("Not authenticated");
      await apiService.cancelScrapeJob(jobId, token);
    },
    storageKey: ACTIVE_JOB_KEY,
    placeholder: (jobId, lbusername) => {
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
        lbusername,
      };
    },
  });
};
