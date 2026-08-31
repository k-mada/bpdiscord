import { useState } from "react";

import {
  LETTERBOXD_BLOCKED_REASON,
  type RefreshJob,
  type RefreshJobPhase,
  type RefreshJobStatus,
} from "../types";
import Spinner from "./Spinner";

const PHASE_ORDER: Array<{ key: RefreshJobPhase; label: string }> = [
  { key: "user_scrape", label: "User film scrape" },
  { key: "missing_films", label: "Find missing films" },
  { key: "film_ratings", label: "Letterboxd ratings" },
];

type PhaseRowStatus = "pending" | "running" | "done";

function phaseRowStatus(
  job: RefreshJob,
  phase: RefreshJobPhase,
): PhaseRowStatus {
  const has = job.progress[phase] !== undefined;
  // Status and phase are separate worker-side writes, so on cancel/complete
  // there's a window where status is terminal but phase is stale.
  if (job.status === "running" && job.phase === phase) return "running";
  if (has) return "done";
  return "pending";
}

// Background and text must stay on one line per entry: palette.contrast.test.ts
// discovers overlay pairings by scanning line by line.
const TONE = {
  info: "bg-letterboxd-info-surface/20 text-letterboxd-info",
  success: "bg-letterboxd-success-surface/20 text-letterboxd-success",
  warning: "bg-letterboxd-warning-surface/20 text-letterboxd-warning",
  error: "bg-letterboxd-error-surface/20 text-letterboxd-error",
  neutral: "bg-letterboxd-bg-secondary text-letterboxd-text-secondary",
} as const;

export function statusBadge(status: RefreshJobStatus): {
  text: string;
  cls: string;
} {
  switch (status) {
    case "running":
      return { text: "Running", cls: TONE.info };
    case "completed":
      return { text: "Completed", cls: TONE.success };
    case "cancelled":
      return { text: "Cancelled", cls: TONE.warning };
    case "failed":
      return { text: "Failed", cls: TONE.error };
    default:
      return { text: status, cls: TONE.neutral };
  }
}

// A 'failed' job whose errors carry the worker's transient-block tag. Rendered
// distinctly from a real failure: it's retry-worthy, not broken.
function isLetterboxdBlocked(job: RefreshJob): boolean {
  return (
    job.status === "failed" &&
    job.errors.some((e) => e.reason === LETTERBOXD_BLOCKED_REASON)
  );
}

function BlockedBanner() {
  return (
    <div
      role="status"
      className="card border-l-2 border-letterboxd-warning-surface/60 bg-letterboxd-warning-surface/20"
    >
      <p className="text-sm text-letterboxd-warning">
        <span className="font-semibold">
          Letterboxd is temporarily blocking requests from the server.
        </span>{" "}
        This usually clears in a few minutes — try again shortly.
      </p>
    </div>
  );
}

function phaseRowIcon(s: PhaseRowStatus) {
  if (s === "done") return "✓";
  if (s === "running") return <Spinner label={null} />;
  return "○";
}

function PhaseRow({
  job,
  phase,
  label,
}: {
  job: RefreshJob;
  phase: RefreshJobPhase;
  label: string;
}) {
  const s = phaseRowStatus(job, phase);
  const progress = job.progress[phase];

  let counter = "";
  let current = "";
  let extra = "";

  if (phase === "user_scrape" && job.progress.user_scrape) {
    const p = job.progress.user_scrape;
    counter = `${p.processed ?? 0} / ${p.total ?? 0} users`;
    if (p.current) current = `currently: ${p.current}`;
    if (p.films_added !== undefined)
      extra = `${p.films_added.toLocaleString()} films seen`;
  } else if (phase === "missing_films" && job.progress.missing_films) {
    counter = `${job.progress.missing_films.count.toLocaleString()} missing slugs`;
  } else if (phase === "film_ratings" && job.progress.film_ratings) {
    const p = job.progress.film_ratings;
    counter = `${p.processed ?? 0} / ${p.total ?? 0} films`;
    if (p.current) current = `currently: ${p.current}`;
  }

  return (
    <div className="card flex items-start gap-4">
      <div
        className={
          "text-xl w-6 text-center " +
          (s === "running"
            ? "text-letterboxd-info"
            : s === "done"
              ? "text-letterboxd-success"
              : "text-letterboxd-text-secondary")
        }
      >
        {phaseRowIcon(s)}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline justify-between">
          <h3 className="text-lg font-semibold text-letterboxd-text-primary">
            {label}
          </h3>
          <span className="text-xs uppercase tracking-wide text-letterboxd-text-secondary">
            {s}
          </span>
        </div>
        {progress === undefined ? (
          <p className="text-sm text-letterboxd-text-secondary mt-1">
            Waiting for previous phase
          </p>
        ) : (
          <div className="mt-1 space-y-0.5 text-sm">
            {counter && (
              <div className="text-letterboxd-text-primary">{counter}</div>
            )}
            {current && (
              <div className="text-letterboxd-text-secondary">{current}</div>
            )}
            {extra && (
              <div className="text-letterboxd-text-secondary">{extra}</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ErrorsPanel({ errors }: { errors: RefreshJob["errors"] }) {
  const [open, setOpen] = useState(false);
  if (errors.length === 0) return null;
  return (
    <div className="card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left flex items-center justify-between"
      >
        <span className="font-semibold text-letterboxd-error">
          Errors ({errors.length})
        </span>
        <span className="text-letterboxd-text-secondary">
          {open ? "Hide" : "Show"}
        </span>
      </button>
      {open && (
        <ul className="mt-3 space-y-2 text-xs font-mono">
          {errors.map((e, i) => (
            <li
              key={`${e.at}-${i}`}
              className="border-l-2 border-letterboxd-error-surface/60 pl-3"
            >
              <div className="text-letterboxd-text-secondary">{e.at}</div>
              <div className="text-letterboxd-text-primary">
                {e.phase}
                {e.item ? `/${e.item}` : ""}: {e.error}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/**
 * Renders the body of a refresh-job view: the "Current job" header card
 * (status badge + id + timestamps), the three-phase progress rows, the
 * collapsible errors panel, and the log tail.
 *
 * Used by both /dashboard/refresh-films (bulk Hater Rankings refresh) and
 * /fetcher (per-user scrape). UserScrapeJob extends RefreshJob, so the same
 * component types apply to both — UserScrapeJob's extra lbusername field is
 * surfaced by the page-specific header outside this component.
 */
const JobProgress = ({ job }: { job: RefreshJob }) => {
  const blocked = isLetterboxdBlocked(job);
  const badge = blocked
    ? { text: "Blocked", cls: TONE.warning }
    : statusBadge(job.status);
  return (
    <>
      <div className="card">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold text-letterboxd-text-primary">
            Current job
          </h2>
          <span
            className={
              "text-xs uppercase tracking-wide px-2 py-1 rounded-sm " + badge.cls
            }
          >
            {badge.text}
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
          <dt className="text-letterboxd-text-secondary">Job id</dt>
          <dd className="font-mono text-xs">{job.id}</dd>
          <dt className="text-letterboxd-text-secondary">Started</dt>
          <dd>{new Date(job.startedAt).toLocaleString()}</dd>
          <dt className="text-letterboxd-text-secondary">Finished</dt>
          <dd>
            {job.finishedAt ? new Date(job.finishedAt).toLocaleString() : "—"}
          </dd>
        </dl>
      </div>

      <div className="space-y-2">
        {PHASE_ORDER.map(({ key, label }) => (
          <PhaseRow key={key} job={job} phase={key} label={label} />
        ))}
      </div>

      {blocked && <BlockedBanner />}

      {/* Block-tagged entries are surfaced by the banner, not as red errors. */}
      <ErrorsPanel
        errors={job.errors.filter(
          (e) => e.reason !== LETTERBOXD_BLOCKED_REASON,
        )}
      />

      {job.logTail && (
        <div className="card">
          <h2 className="text-lg font-semibold text-letterboxd-text-primary mb-2">
            Log
          </h2>
          <pre className="text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto bg-letterboxd-bg-primary p-3 rounded-sm">
            {job.logTail}
          </pre>
        </div>
      )}
    </>
  );
};

export default JobProgress;
