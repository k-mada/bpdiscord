// @vitest-environment jsdom
import { renderHook, waitFor, act } from "@testing-library/react";

import { useRefreshJob } from "../hooks/useRefreshJob";
import apiService from "../services/api";
import type { RefreshJob, RefreshJobStatus } from "../types";

vi.mock("../services/api");

const ACTIVE_JOB_KEY = "activeRefreshJobId";
const TOKEN = "fake-jwt-token";
const JOB_ID = "11111111-2222-3333-4444-555555555555";

// jsdom in this project's vitest config doesn't expose window.localStorage;
// install a Map-backed fake before any test touches storage.
const installFakeLocalStorage = () => {
  const store = new Map<string, string>();
  const fake: Storage = {
    getItem: (k) => (store.has(k) ? store.get(k)! : null),
    setItem: (k, v) => {
      store.set(k, String(v));
    },
    removeItem: (k) => {
      store.delete(k);
    },
    clear: () => {
      store.clear();
    },
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() {
      return store.size;
    },
  };
  Object.defineProperty(globalThis, "localStorage", {
    value: fake,
    writable: true,
    configurable: true,
  });
  Object.defineProperty(window, "localStorage", {
    value: fake,
    writable: true,
    configurable: true,
  });
};

const baseJob: RefreshJob = {
  id: JOB_ID,
  status: "running",
  started_at: "2026-05-10T00:00:00Z",
  finished_at: null,
  started_by: "alice",
  phase: "user_scrape",
  progress: { user_scrape: { processed: 1, total: 5 } },
  errors: [],
  log_tail: "",
  updated_at: "2026-05-10T00:00:01Z",
};

function jobWith(status: RefreshJobStatus, overrides: Partial<RefreshJob> = {}): RefreshJob {
  return {
    ...baseJob,
    status,
    finished_at: status === "running" ? null : "2026-05-10T00:01:00Z",
    phase: status === "running" ? "user_scrape" : null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  installFakeLocalStorage();
  localStorage.setItem("token", TOKEN);
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// mount-time behavior
// ---------------------------------------------------------------------------

describe("useRefreshJob — mount", () => {
  it("does nothing when localStorage has no saved job id", () => {
    const { result } = renderHook(() => useRefreshJob());
    expect(result.current.job).toBeNull();
    expect(apiService.getRefreshJob).not.toHaveBeenCalled();
  });

  it("resumes a running job from localStorage and starts polling", async () => {
    localStorage.setItem(ACTIVE_JOB_KEY, JOB_ID);
    vi.mocked(apiService.getRefreshJob).mockResolvedValue({
      data: jobWith("running"),
    });

    const { result } = renderHook(() => useRefreshJob());

    await waitFor(() => expect(result.current.job).not.toBeNull());
    expect(result.current.job?.status).toBe("running");
    expect(apiService.getRefreshJob).toHaveBeenCalledWith(JOB_ID, TOKEN);
  });

  it("loads a terminal job from localStorage but does NOT poll", async () => {
    localStorage.setItem(ACTIVE_JOB_KEY, JOB_ID);
    vi.mocked(apiService.getRefreshJob).mockResolvedValue({
      data: jobWith("completed"),
    });

    const { result } = renderHook(() => useRefreshJob());

    await waitFor(() => expect(result.current.job?.status).toBe("completed"));
    // Localstorage cleared because the job is terminal — no point resuming.
    expect(localStorage.getItem(ACTIVE_JOB_KEY)).toBeNull();
  });

  it("clears localStorage when the saved job_id 404s", async () => {
    localStorage.setItem(ACTIVE_JOB_KEY, JOB_ID);
    vi.mocked(apiService.getRefreshJob).mockRejectedValue(
      new Error("Job not found"),
    );

    renderHook(() => useRefreshJob());

    await waitFor(() =>
      expect(localStorage.getItem(ACTIVE_JOB_KEY)).toBeNull(),
    );
  });
});

// ---------------------------------------------------------------------------
// trigger
// ---------------------------------------------------------------------------

describe("useRefreshJob — trigger", () => {
  it("posts, saves job_id to localStorage, sets job optimistically, and starts polling", async () => {
    vi.mocked(apiService.triggerRefresh).mockResolvedValue({
      data: { job_id: JOB_ID },
    });
    vi.mocked(apiService.getRefreshJob).mockResolvedValue({
      data: jobWith("running"),
    });

    vi.useFakeTimers();
    const { result } = renderHook(() => useRefreshJob());

    await act(async () => {
      await result.current.trigger();
    });

    expect(apiService.triggerRefresh).toHaveBeenCalledWith(TOKEN);
    expect(localStorage.getItem(ACTIVE_JOB_KEY)).toBe(JOB_ID);
    // Optimistic placeholder
    expect(result.current.job?.id).toBe(JOB_ID);
    expect(result.current.job?.status).toBe("running");

    // Advance to first poll tick — should fetch the real row.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(apiService.getRefreshJob).toHaveBeenCalledWith(JOB_ID, TOKEN);
  });

  it("surfaces an error on trigger failure (e.g. 409 from server)", async () => {
    vi.mocked(apiService.triggerRefresh).mockRejectedValue(
      new Error("Another refresh job is already running"),
    );

    const { result } = renderHook(() => useRefreshJob());

    await act(async () => {
      await result.current.trigger();
    });

    expect(result.current.error).toContain("Another refresh job is already running");
    expect(localStorage.getItem(ACTIVE_JOB_KEY)).toBeNull();
    expect(result.current.job).toBeNull();
  });

  it("flips isTriggering during the request and back after", async () => {
    let resolveTrigger: (value: { data: { job_id: string } }) => void;
    const triggerPromise = new Promise<{ data: { job_id: string } }>(
      (resolve) => {
        resolveTrigger = resolve;
      },
    );
    vi.mocked(apiService.triggerRefresh).mockReturnValue(
      triggerPromise as ReturnType<typeof apiService.triggerRefresh>,
    );

    const { result } = renderHook(() => useRefreshJob());

    let triggerCall: Promise<void>;
    act(() => {
      triggerCall = result.current.trigger();
    });

    await waitFor(() => expect(result.current.isTriggering).toBe(true));

    await act(async () => {
      resolveTrigger!({ data: { job_id: JOB_ID } });
      await triggerCall!;
    });

    expect(result.current.isTriggering).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// polling lifecycle
// ---------------------------------------------------------------------------

describe("useRefreshJob — polling", () => {
  it("stops polling when the job reaches a terminal status", async () => {
    vi.mocked(apiService.triggerRefresh).mockResolvedValue({
      data: { job_id: JOB_ID },
    });
    // First poll: still running. Second poll: completed.
    vi.mocked(apiService.getRefreshJob)
      .mockResolvedValueOnce({ data: jobWith("running") })
      .mockResolvedValueOnce({ data: jobWith("completed") });

    vi.useFakeTimers();
    const { result } = renderHook(() => useRefreshJob());

    await act(async () => {
      await result.current.trigger();
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.job?.status).toBe("running");

    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.job?.status).toBe("completed");
    expect(localStorage.getItem(ACTIVE_JOB_KEY)).toBeNull();

    // Further ticks should NOT call the API again.
    vi.mocked(apiService.getRefreshJob).mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(apiService.getRefreshJob).not.toHaveBeenCalled();
  });

  it("clears the interval on unmount", async () => {
    vi.mocked(apiService.triggerRefresh).mockResolvedValue({
      data: { job_id: JOB_ID },
    });
    vi.mocked(apiService.getRefreshJob).mockResolvedValue({
      data: jobWith("running"),
    });

    vi.useFakeTimers();
    const { result, unmount } = renderHook(() => useRefreshJob());

    await act(async () => {
      await result.current.trigger();
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(apiService.getRefreshJob).toHaveBeenCalledTimes(1);

    unmount();

    vi.mocked(apiService.getRefreshJob).mockClear();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(apiService.getRefreshJob).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// cancel
// ---------------------------------------------------------------------------

describe("useRefreshJob — cancel", () => {
  it("calls the cancel endpoint when invoked while running", async () => {
    vi.mocked(apiService.triggerRefresh).mockResolvedValue({
      data: { job_id: JOB_ID },
    });
    vi.mocked(apiService.getRefreshJob).mockResolvedValue({
      data: jobWith("running"),
    });
    vi.mocked(apiService.cancelRefreshJob).mockResolvedValue({
      data: { id: JOB_ID, status: "cancelled" },
    });

    const { result } = renderHook(() => useRefreshJob());

    await act(async () => {
      await result.current.trigger();
    });
    await act(async () => {
      await result.current.cancel();
    });

    expect(apiService.cancelRefreshJob).toHaveBeenCalledWith(JOB_ID, TOKEN);
  });

  it("is a no-op when there is no current job", async () => {
    const { result } = renderHook(() => useRefreshJob());
    await act(async () => {
      await result.current.cancel();
    });
    expect(apiService.cancelRefreshJob).not.toHaveBeenCalled();
  });

  it("surfaces an error if the cancel call fails", async () => {
    vi.mocked(apiService.triggerRefresh).mockResolvedValue({
      data: { job_id: JOB_ID },
    });
    vi.mocked(apiService.getRefreshJob).mockResolvedValue({
      data: jobWith("running"),
    });
    vi.mocked(apiService.cancelRefreshJob).mockRejectedValue(
      new Error("Job is not running and cannot be cancelled"),
    );

    const { result } = renderHook(() => useRefreshJob());
    await act(async () => {
      await result.current.trigger();
    });
    await act(async () => {
      await result.current.cancel();
    });

    expect(result.current.error).toContain("not running");
  });
});

// ---------------------------------------------------------------------------
// auth
// ---------------------------------------------------------------------------

describe("useRefreshJob — auth", () => {
  it("surfaces 'Not authenticated' if token is missing on trigger", async () => {
    localStorage.removeItem("token");
    const { result } = renderHook(() => useRefreshJob());
    await act(async () => {
      await result.current.trigger();
    });
    expect(result.current.error).toBe("Not authenticated");
    expect(apiService.triggerRefresh).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// regression tests for code-review fixes
// ---------------------------------------------------------------------------

describe("useRefreshJob — recovery", () => {
  it("clears a stale 'Lost connection' banner once polling recovers", async () => {
    vi.mocked(apiService.triggerRefresh).mockResolvedValue({
      data: { job_id: JOB_ID },
    });
    // Five consecutive failures, then a successful poll.
    vi.mocked(apiService.getRefreshJob)
      .mockRejectedValueOnce(new Error("network"))
      .mockRejectedValueOnce(new Error("network"))
      .mockRejectedValueOnce(new Error("network"))
      .mockRejectedValueOnce(new Error("network"))
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValue({ data: jobWith("running") });

    vi.useFakeTimers();
    const { result } = renderHook(() => useRefreshJob());

    await act(async () => {
      await result.current.trigger();
    });
    // Drive 5 failed polls.
    for (let i = 0; i < 5; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
    }
    expect(result.current.error).toMatch(/Lost connection/);

    // Recovery on the 6th tick.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    expect(result.current.error).toBeNull();
  });
});

describe("useRefreshJob — mount-trigger race", () => {
  it("does not overwrite a fresh trigger() with a stale resume fetch", async () => {
    // Simulate the race: localStorage has a saved id whose fetch is slow,
    // user clicks Run before the fetch resolves.
    const STALE_JOB_ID = "00000000-0000-0000-0000-000000000000";
    localStorage.setItem(ACTIVE_JOB_KEY, STALE_JOB_ID);

    let resolveStaleFetch: (value: { data: RefreshJob }) => void;
    const staleFetchPromise = new Promise<{ data: RefreshJob }>((resolve) => {
      resolveStaleFetch = resolve;
    });
    vi.mocked(apiService.getRefreshJob)
      .mockReturnValueOnce(
        staleFetchPromise as ReturnType<typeof apiService.getRefreshJob>,
      )
      // Subsequent polls of the new job
      .mockResolvedValue({ data: jobWith("running", { id: JOB_ID }) });
    vi.mocked(apiService.triggerRefresh).mockResolvedValue({
      data: { job_id: JOB_ID },
    });

    const { result } = renderHook(() => useRefreshJob());

    // User clicks Run while resume fetch is in flight.
    await act(async () => {
      await result.current.trigger();
    });
    expect(result.current.job?.id).toBe(JOB_ID);

    // Now the stale fetch resolves with the OLD job id.
    await act(async () => {
      resolveStaleFetch!({
        data: jobWith("running", { id: STALE_JOB_ID }),
      });
      // Let the microtasks settle.
      await Promise.resolve();
    });

    // The new job MUST still be the visible one — resume should have been
    // abandoned because intervalRef was already set by trigger().
    expect(result.current.job?.id).toBe(JOB_ID);
  });
});
