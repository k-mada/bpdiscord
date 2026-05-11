import { useCallback, useEffect, useRef, useState } from "react";

import { apiService } from "../services/api";
import type { RefreshJob } from "../types";

const POLL_INTERVAL_MS = 2000;
const ACTIVE_JOB_KEY = "activeRefreshJobId";
// Surface a "lost connection" banner only after this many consecutive poll
// failures — single transient network blips are silently retried.
const POLL_FAILURE_THRESHOLD = 5;

const isTerminal = (status: RefreshJob["status"]): boolean =>
  status === "completed" || status === "failed" || status === "cancelled";

/**
 * Owns the lifecycle of the admin's active refresh job.
 *
 * - On mount, if localStorage has a saved job_id, fetch it. Resume polling if
 *   the row is still running; otherwise show the terminal state without polling.
 * - On trigger(), POST /api/admin/refresh-rankings, save job_id to localStorage,
 *   and start polling.
 * - On cancel(), POST /cancel. The next poll picks up the cancelled state
 *   and stops the loop naturally.
 * - Polling uses setInterval at 2s. Stops on terminal status or unmount.
 */
export const useRefreshJob = () => {
  const [job, setJob] = useState<RefreshJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const consecutiveFailuresRef = useRef(0);

  const getToken = (): string | null => localStorage.getItem("token");

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    consecutiveFailuresRef.current = 0;
  }, []);

  const fetchJobOnce = useCallback(async (jobId: string): Promise<RefreshJob | null> => {
    const token = getToken();
    if (!token) {
      setError("Not authenticated");
      return null;
    }
    try {
      const response = await apiService.getRefreshJob(jobId, token);
      const fetched = response.data ?? null;
      consecutiveFailuresRef.current = 0;
      // Clear any stale "Lost connection" banner now that we've recovered.
      setError((prev) => (prev?.startsWith("Lost connection") ? null : prev));
      return fetched;
    } catch (e) {
      consecutiveFailuresRef.current += 1;
      const msg = e instanceof Error ? e.message : "Unknown error";
      // 404 = job vanished (cleaned up out of band). Stop & forget it.
      if (msg.toLowerCase().includes("not found")) {
        localStorage.removeItem(ACTIVE_JOB_KEY);
        setJob(null);
        return null;
      }
      if (consecutiveFailuresRef.current >= POLL_FAILURE_THRESHOLD) {
        setError(`Lost connection: ${msg}`);
      }
      return null;
    }
  }, []);

  const startPolling = useCallback(
    (jobId: string) => {
      stopPolling();
      intervalRef.current = setInterval(async () => {
        const fetched = await fetchJobOnce(jobId);
        if (fetched === null) return;
        setJob(fetched);
        if (isTerminal(fetched.status)) {
          stopPolling();
          localStorage.removeItem(ACTIVE_JOB_KEY);
        }
      }, POLL_INTERVAL_MS);
    },
    [fetchJobOnce, stopPolling],
  );

  // Mount: resume from localStorage if there's a saved job id.
  // Cancels itself if the user triggers a fresh job before the in-flight
  // resume fetch resolves (would otherwise stomp the new job and leak an
  // interval).
  useEffect(() => {
    const savedId = localStorage.getItem(ACTIVE_JOB_KEY);
    if (!savedId) return;
    let abandoned = false;
    void (async () => {
      const fetched = await fetchJobOnce(savedId);
      // Skip if unmounted, OR if a trigger() already started polling — that
      // means the user clicked Run while we were resolving the resume fetch.
      if (abandoned || intervalRef.current !== null) return;
      if (fetched === null) return;
      setJob(fetched);
      if (!isTerminal(fetched.status)) startPolling(savedId);
      else localStorage.removeItem(ACTIVE_JOB_KEY);
    })();
    return () => {
      abandoned = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount.
  useEffect(() => stopPolling, [stopPolling]);

  const trigger = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setError("Not authenticated");
      return;
    }
    setError(null);
    setIsTriggering(true);
    try {
      const response = await apiService.triggerRefresh(token);
      const jobId = response.data?.job_id;
      if (!jobId) {
        setError("Server did not return a job id");
        return;
      }
      localStorage.setItem(ACTIVE_JOB_KEY, jobId);
      // Optimistic: insert a placeholder row so the UI flips to "running"
      // immediately; the first poll tick will replace it with the real shape.
      const now = new Date().toISOString();
      setJob({
        id: jobId,
        status: "running",
        started_at: now,
        finished_at: null,
        started_by: "",
        phase: null,
        progress: {},
        errors: [],
        log_tail: "",
        updated_at: now,
      });
      startPolling(jobId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setIsTriggering(false);
    }
  }, [startPolling]);

  const cancel = useCallback(async () => {
    if (!job) return;
    const token = getToken();
    if (!token) {
      setError("Not authenticated");
      return;
    }
    setError(null);
    setIsCancelling(true);
    try {
      await apiService.cancelRefreshJob(job.id, token);
      // The next poll tick will reflect the cancelled state and stop the loop.
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setError(msg);
    } finally {
      setIsCancelling(false);
    }
  }, [job]);

  return {
    job,
    error,
    isTriggering,
    isCancelling,
    trigger,
    cancel,
  };
};
