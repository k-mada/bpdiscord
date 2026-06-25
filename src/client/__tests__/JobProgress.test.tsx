import { render, screen } from "@testing-library/react";

import JobProgress from "../components/JobProgress";
import type { RefreshJob, RefreshJobErrorEntry } from "../types";

vi.mock("../components/Spinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

function makeJob(overrides: Partial<RefreshJob> = {}): RefreshJob {
  return {
    id: "job-1",
    status: "failed",
    startedAt: "2026-06-25T00:00:00Z",
    finishedAt: "2026-06-25T00:01:00Z",
    startedBy: "tester",
    phase: null,
    progress: {},
    errors: [],
    logTail: "",
    updatedAt: "2026-06-25T00:01:00Z",
    ...overrides,
  };
}

const blockedError: RefreshJobErrorEntry = {
  phase: "user_scrape",
  item: null,
  error: "AccessDeniedError: IP blocked",
  at: "2026-06-25T00:00:30Z",
  reason: "letterboxd_blocked",
};

const genericError: RefreshJobErrorEntry = {
  phase: "user_scrape",
  item: "alice",
  error: "ValueError: parse failed",
  at: "2026-06-25T00:00:30Z",
};

describe("JobProgress block handling", () => {
  it("shows the Blocked badge and banner for a letterboxd_blocked failure", () => {
    render(<JobProgress job={makeJob({ errors: [blockedError] })} />);

    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(screen.queryByText("Failed")).not.toBeInTheDocument();
    expect(
      screen.getByText(/temporarily blocking requests/i),
    ).toBeInTheDocument();
  });

  it("renders a generic failure (no banner, Failed badge) for an untagged error", () => {
    render(<JobProgress job={makeJob({ errors: [genericError] })} />);

    expect(screen.getByText("Failed")).toBeInTheDocument();
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/temporarily blocking requests/i),
    ).not.toBeInTheDocument();
  });

  it("treats a job with both a block and a generic error as blocked", () => {
    render(
      <JobProgress job={makeJob({ errors: [genericError, blockedError] })} />,
    );

    expect(screen.getByText("Blocked")).toBeInTheDocument();
    expect(
      screen.getByText(/temporarily blocking requests/i),
    ).toBeInTheDocument();
    // The generic error still surfaces; the block entry is folded into the
    // banner, not the red errors panel.
    expect(screen.getByText(/Errors \(1\)/)).toBeInTheDocument();
  });

  it("hides the block entry from the errors panel", () => {
    render(<JobProgress job={makeJob({ errors: [blockedError] })} />);
    // Only the block error exists, and it's surfaced by the banner — so the
    // collapsible errors panel renders nothing.
    expect(screen.queryByText(/Errors \(/)).not.toBeInTheDocument();
  });

  it("does not treat a completed job with a stale block error as blocked", () => {
    render(
      <JobProgress
        job={makeJob({ status: "completed", errors: [blockedError] })}
      />,
    );

    expect(screen.getByText("Completed")).toBeInTheDocument();
    expect(screen.queryByText("Blocked")).not.toBeInTheDocument();
    expect(
      screen.queryByText(/temporarily blocking requests/i),
    ).not.toBeInTheDocument();
  });
});
