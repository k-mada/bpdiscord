import { useCallback, useEffect, useRef, useState } from "react";

import type { RefreshJob, RefreshJobStatus } from "../types";

const POLL_INTERVAL_MS = 2000;
// Surface a "lost connection" banner only after this many consecutive poll
// failures — single transient network blips are silently retried.
const POLL_FAILURE_THRESHOLD = 5;

/**
 * The minimum job shape this hook polls. Both the bulk refresh_jobs row
 * and the per-user user_scrape_jobs row satisfy this — the latter just
 * carries extra columns (e.g. lbusername) which flow through opaquely.
 */
export type BaseJob = RefreshJob;

export interface UseJobConfig<TJob extends BaseJob, TTriggerArg = void> {
  /** Start a fresh job and return its id. Throws on auth/network failure. */
  trigger(arg: TTriggerArg): Promise<string>;
  /** Read current job state. Returns null if the row vanished. */
  poll(jobId: string): Promise<TJob | null>;
  /** Request cancellation. */
  cancel(jobId: string): Promise<void>;
  /** localStorage key for resume-on-mount. Different per consumer. */
  storageKey: string;
  /**
   * Optimistic placeholder shown immediately after trigger() so the UI
   * flips to "running" without waiting for the first poll tick.
   */
  placeholder(jobId: string, arg: TTriggerArg): TJob;
}

const isTerminal = (status: RefreshJobStatus): boolean =>
  status === "completed" || status === "failed" || status === "cancelled";

/**
 * Generic refresh-job lifecycle owner. Handles polling, retry,
 * resume-from-localStorage, terminal detection, and lost-connection
 * surfacing. Domain-specific concerns (API method binding, auth tokens,
 * placeholder shape) live in the consumer wrapper.
 *
 * Used by useRefreshJob (bulk Hater Rankings refresh) and useScrapeJob
 * (per-user /fetcher refresh). Wrappers are thin enough that the polling
 * mechanics live in exactly one place — any bug fix to (e.g.) the
 * lost-connection threshold automatically benefits both flows.
 */
export const useJob = <TJob extends BaseJob, TTriggerArg = void>(
  cfg: UseJobConfig<TJob, TTriggerArg>,
) => {
  const [job, setJob] = useState<TJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isTriggering, setIsTriggering] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const consecutiveFailuresRef = useRef(0);
  // Capture cfg in a ref so polling callbacks always see the latest binding
  // without re-creating the interval on every render.
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    consecutiveFailuresRef.current = 0;
  }, []);

  const fetchJobOnce = useCallback(async (jobId: string): Promise<TJob | null> => {
    try {
      const fetched = await cfgRef.current.poll(jobId);
      consecutiveFailuresRef.current = 0;
      setError((prev) => (prev?.startsWith("Lost connection") ? null : prev));
      return fetched;
    } catch (e) {
      consecutiveFailuresRef.current += 1;
      const msg = e instanceof Error ? e.message : "Unknown error";
      // 404 = job vanished (cleaned up out of band). Stop & forget it.
      if (msg.toLowerCase().includes("not found")) {
        localStorage.removeItem(cfgRef.current.storageKey);
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
          localStorage.removeItem(cfgRef.current.storageKey);
        }
      }, POLL_INTERVAL_MS);
    },
    [fetchJobOnce, stopPolling],
  );

  // Mount: resume from localStorage if there's a saved job id. Aborts itself
  // if the user triggers a fresh job before the resume fetch resolves —
  // otherwise the resume would stomp the new job and leak an interval.
  useEffect(() => {
    const savedId = localStorage.getItem(cfgRef.current.storageKey);
    if (!savedId) return;
    let abandoned = false;
    void (async () => {
      const fetched = await fetchJobOnce(savedId);
      if (abandoned || intervalRef.current !== null) return;
      if (fetched === null) return;
      setJob(fetched);
      if (!isTerminal(fetched.status)) startPolling(savedId);
      else localStorage.removeItem(cfgRef.current.storageKey);
    })();
    return () => {
      abandoned = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cleanup on unmount.
  useEffect(() => stopPolling, [stopPolling]);

  const trigger = useCallback(
    async (arg: TTriggerArg) => {
      setError(null);
      setIsTriggering(true);
      try {
        const jobId = await cfgRef.current.trigger(arg);
        localStorage.setItem(cfgRef.current.storageKey, jobId);
        // Optimistic: insert a placeholder row so the UI flips to "running"
        // immediately; the first poll tick will replace it with the real shape.
        setJob(cfgRef.current.placeholder(jobId, arg));
        startPolling(jobId);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Unknown error";
        setError(msg);
      } finally {
        setIsTriggering(false);
      }
    },
    [startPolling],
  );

  const cancel = useCallback(async () => {
    if (!job) return;
    setError(null);
    setIsCancelling(true);
    try {
      await cfgRef.current.cancel(job.id);
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
