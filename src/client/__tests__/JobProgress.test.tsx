import { render, screen } from "@testing-library/react";

import JobProgress from "../components/JobProgress";
import type { RefreshJob, RefreshJobErrorEntry } from "../types";

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

describe("JobProgress header", () => {
  it("does not render the job id", () => {
    render(<JobProgress job={makeJob({ id: "job-xyz" })} />);
    expect(screen.queryByText("Job id")).not.toBeInTheDocument();
    expect(screen.queryByText("job-xyz")).not.toBeInTheDocument();
  });

  it("shows an elapsed time for a terminal job (finished − started)", () => {
    render(
      <JobProgress
        job={makeJob({
          status: "completed",
          startedAt: "2026-06-25T00:00:00Z",
          finishedAt: "2026-06-25T00:01:05Z",
        })}
      />,
    );
    expect(screen.getByText("Elapsed")).toBeInTheDocument();
    expect(screen.getByText("1:05")).toBeInTheDocument();
  });
});

describe("JobProgress steps", () => {
  it("renders a users progress bar with aria values for the user_scrape step", () => {
    render(
      <JobProgress
        job={makeJob({
          status: "running",
          phase: "user_scrape",
          progress: {
            user_scrape: {
              processed: 40,
              total: 45,
              current: "alice",
              films_added: 123,
            },
          },
        })}
      />,
    );

    const bar = screen.getByRole("progressbar", { name: /users/i });
    expect(bar).toHaveAttribute("aria-valuenow", "40");
    expect(bar).toHaveAttribute("aria-valuemax", "45");
    expect(screen.getByText("Current user: alice")).toBeInTheDocument();
    expect(screen.getByText("123 films seen")).toBeInTheDocument();
  });

  it("renders a films progress bar for the film_ratings step", () => {
    render(
      <JobProgress
        job={makeJob({
          status: "running",
          phase: "film_ratings",
          progress: {
            user_scrape: { processed: 45, total: 45 },
            missing_films: { count: 10 },
            film_ratings: { processed: 3, total: 10, current: "Dune" },
          },
        })}
      />,
    );

    const bar = screen.getByRole("progressbar", { name: /films/i });
    expect(bar).toHaveAttribute("aria-valuenow", "3");
    expect(bar).toHaveAttribute("aria-valuemax", "10");
    expect(screen.getByText("Current film: Dune")).toBeInTheDocument();
  });

  it("renders an indeterminate progress bar (no aria-valuenow) before counts are known", () => {
    render(
      <JobProgress
        job={makeJob({
          status: "running",
          phase: "user_scrape",
          progress: { user_scrape: { processed: 0, total: 0 } },
        })}
      />,
    );

    const bar = screen.getByRole("progressbar", { name: /users/i });
    expect(bar).not.toHaveAttribute("aria-valuenow");
    expect(bar).not.toHaveAttribute("aria-valuemax");
  });

  it("announces each step's status to screen readers", () => {
    render(
      <JobProgress
        job={makeJob({
          status: "running",
          phase: "user_scrape",
          progress: { user_scrape: { processed: 1, total: 45 } },
        })}
      />,
    );

    expect(
      screen.getByText("User film scrape").closest("h3"),
    ).toHaveTextContent("in progress");
    expect(
      screen.getByText("Letterboxd ratings").closest("h3"),
    ).toHaveTextContent("not started");
  });

  it("styles a not-yet-started step as inactive", () => {
    render(
      <JobProgress
        job={makeJob({
          status: "running",
          phase: "user_scrape",
          progress: { user_scrape: { processed: 1, total: 45 } },
        })}
      />,
    );

    const pending = screen
      .getByText("Letterboxd ratings")
      .closest("li") as HTMLElement;
    expect(pending.className).toContain("opacity-60");

    const active = screen
      .getByText("User film scrape")
      .closest("li") as HTMLElement;
    expect(active.className).not.toContain("opacity-60");
  });
});
