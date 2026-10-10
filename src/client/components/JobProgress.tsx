import Card from "./Card";
import { useEffect, useState } from "react";

import {
  LETTERBOXD_BLOCKED_REASON,
  type RefreshJob,
  type RefreshJobPhase,
  type RefreshJobStatus,
} from "../types";

const PHASE_ORDER: Array<{ key: RefreshJobPhase; label: string }> = [
  { key: "user_scrape", label: "User film scrape" },
  { key: "missing_films", label: "Find missing films" },
  { key: "film_ratings", label: "Letterboxd ratings" },
];

type PhaseRowStatus = "pending" | "running" | "done";

function formatDuration(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

// Ticks every 1s while running — the 2s poll loop alone would stutter the
// clock. Terminal jobs show the fixed finished−started span.
function useElapsed(job: RefreshJob): string {
  const start = new Date(job.startedAt).getTime();
  const running = job.status === "running";
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  const end = running
    ? now
    : job.finishedAt
      ? new Date(job.finishedAt).getTime()
      : start;
  return formatDuration(end - start);
}

function ProgressBar({
  processed,
  total,
  label,
}: {
  processed: number;
  total: number;
  label: string;
}) {
  const pct = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuenow={processed}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`${label}: ${processed} of ${total}`}
      className="space-y-1"
    >
      <div className="h-2 w-full overflow-hidden rounded-full bg-letterboxd-bg-primary">
        <div
          className="h-full rounded-full bg-letterboxd-accent transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-letterboxd-text-secondary">
        {processed.toLocaleString()} / {total.toLocaleString()} {label}
      </div>
    </div>
  );
}

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
    <Card
      role="status"
      className="border-l-2 border-letterboxd-warning-surface/60 bg-letterboxd-warning-surface/20"
    >
      <p className="text-sm text-letterboxd-warning">
        <span className="font-semibold">
          Letterboxd is temporarily blocking requests from the server.
        </span>{" "}
        This usually clears in a few minutes — try again shortly.
      </p>
    </Card>
  );
}

function StepBadge({ status, step }: { status: PhaseRowStatus; step: number }) {
  const active = status !== "pending";
  const cls = active
    ? "bg-letterboxd-accent text-black border-transparent"
    : "border-letterboxd-border-light text-letterboxd-text-secondary";
  return (
    <span
      aria-hidden
      className={
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-sm font-semibold " +
        cls
      }
    >
      {status === "done" ? "✓" : step}
    </span>
  );
}

function StepBody({
  job,
  phase,
  status,
}: {
  job: RefreshJob;
  phase: RefreshJobPhase;
  status: PhaseRowStatus;
}) {
  if (job.progress[phase] === undefined) {
    return (
      <p className="mt-1 text-sm text-letterboxd-text-secondary">
        {status === "running" ? "Starting…" : "Waiting for previous step"}
      </p>
    );
  }

  if (phase === "user_scrape" && job.progress.user_scrape) {
    const p = job.progress.user_scrape;
    return (
      <div className="mt-2 space-y-1 text-sm">
        <ProgressBar
          processed={p.processed ?? 0}
          total={p.total ?? 0}
          label="users"
        />
        {p.current && (
          <div className="text-letterboxd-text-secondary">
            Current user: {p.current}
          </div>
        )}
        {p.films_added !== undefined && (
          <div className="text-letterboxd-text-secondary">
            {p.films_added.toLocaleString()} films seen
          </div>
        )}
      </div>
    );
  }

  if (phase === "film_ratings" && job.progress.film_ratings) {
    const p = job.progress.film_ratings;
    return (
      <div className="mt-2 space-y-1 text-sm">
        <ProgressBar
          processed={p.processed ?? 0}
          total={p.total ?? 0}
          label="films"
        />
        {p.current && (
          <div className="text-letterboxd-text-secondary">
            Current film: {p.current}
          </div>
        )}
      </div>
    );
  }

  if (phase === "missing_films" && job.progress.missing_films) {
    return (
      <div className="mt-2 text-sm text-letterboxd-text-primary">
        {job.progress.missing_films.count.toLocaleString()} missing slugs
      </div>
    );
  }

  return null;
}

function StepRow({
  job,
  phase,
  label,
  step,
}: {
  job: RefreshJob;
  phase: RefreshJobPhase;
  label: string;
  step: number;
}) {
  const status = phaseRowStatus(job, phase);
  const inactive = status === "pending";
  return (
    <li className={"flex items-start gap-3" + (inactive ? " opacity-60" : "")}>
      <StepBadge status={status} step={step} />
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-semibold text-letterboxd-text-primary">
            {label}
          </h3>
          {status === "running" && (
            <span
              aria-hidden
              className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-letterboxd-info border-b-transparent"
            />
          )}
        </div>
        <StepBody job={job} phase={phase} status={status} />
      </div>
    </li>
  );
}

function ErrorsPanel({ errors }: { errors: RefreshJob["errors"] }) {
  const [open, setOpen] = useState(false);
  if (errors.length === 0) return null;
  return (
    <Card>
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
    </Card>
  );
}

/**
 * Renders the body of a refresh-job view: one "Current job" card holding the
 * status badge, timestamps + elapsed time, and the three numbered phase steps;
 * followed by the collapsible errors panel and the log tail in their own cards.
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
  const elapsed = useElapsed(job);
  return (
    <>
      <Card className="space-y-5">
        <div>
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold text-letterboxd-text-primary">
              Current job
            </h2>
            <span
              className={
                "text-xs uppercase tracking-wide px-2 py-1 rounded-sm " +
                badge.cls
              }
            >
              {badge.text}
            </span>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
            <dt className="text-letterboxd-text-secondary">Started</dt>
            <dd>{new Date(job.startedAt).toLocaleString()}</dd>
            <dt className="text-letterboxd-text-secondary">Finished</dt>
            <dd>
              {job.finishedAt ? new Date(job.finishedAt).toLocaleString() : "—"}
            </dd>
            <dt className="text-letterboxd-text-secondary">Elapsed</dt>
            <dd className="tabular-nums">{elapsed}</dd>
          </dl>
        </div>

        <ol className="space-y-5 border-t border-letterboxd-border pt-5">
          {PHASE_ORDER.map(({ key, label }, i) => (
            <StepRow
              key={key}
              job={job}
              phase={key}
              label={label}
              step={i + 1}
            />
          ))}
        </ol>
      </Card>

      {blocked && <BlockedBanner />}

      {/* Block-tagged entries are surfaced by the banner, not as red errors. */}
      <ErrorsPanel
        errors={job.errors.filter(
          (e) => e.reason !== LETTERBOXD_BLOCKED_REASON,
        )}
      />

      {job.logTail && (
        <Card>
          <h2 className="text-lg font-semibold text-letterboxd-text-primary mb-2">
            Log
          </h2>
          <pre className="text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto bg-letterboxd-bg-primary p-3 rounded-sm">
            {job.logTail}
          </pre>
        </Card>
      )}
    </>
  );
};

export default JobProgress;
