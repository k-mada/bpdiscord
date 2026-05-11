import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useRefreshJob } from "../hooks/useRefreshJob";
import type {
  RefreshJob,
  RefreshJobPhase,
  RefreshJobStatus,
} from "../types";

const PHASE_ORDER: Array<{ key: RefreshJobPhase; label: string }> = [
  { key: "user_scrape", label: "User film scrape" },
  { key: "missing_films", label: "Find missing films" },
  { key: "film_ratings", label: "Letterboxd ratings" },
];

type PhaseRowStatus = "pending" | "running" | "done";

function phaseRowStatus(job: RefreshJob, phase: RefreshJobPhase): PhaseRowStatus {
  const has = job.progress[phase] !== undefined;
  if (job.phase === phase) return "running";
  if (has) return "done";
  return "pending";
}

function statusBadge(status: RefreshJobStatus): { text: string; cls: string } {
  switch (status) {
    case "running":
      return { text: "Running", cls: "bg-blue-500/20 text-blue-300" };
    case "completed":
      return { text: "Completed", cls: "bg-green-500/20 text-green-300" };
    case "cancelled":
      return { text: "Cancelled", cls: "bg-yellow-500/20 text-yellow-300" };
    case "failed":
      return { text: "Failed", cls: "bg-red-500/20 text-red-300" };
    default:
      return { text: status, cls: "bg-gray-500/20 text-gray-300" };
  }
}

function phaseRowIcon(s: PhaseRowStatus) {
  if (s === "done") return "✓";
  if (s === "running") return "▶";
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
    if (p.films_added !== undefined) extra = `${p.films_added.toLocaleString()} films seen`;
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
            ? "text-blue-400"
            : s === "done"
              ? "text-green-400"
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
            {counter && <div className="text-letterboxd-text-primary">{counter}</div>}
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
        <span className="font-semibold text-red-400">
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
              className="border-l-2 border-red-500/40 pl-3"
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

const AdminRefresh = () => {
  const navigate = useNavigate();
  const { job, error, isTriggering, isCancelling, trigger, cancel } =
    useRefreshJob();

  const isRunning = job?.status === "running";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="text-sm text-letterboxd-text-secondary hover:text-letterboxd-accent mb-2"
          >
            ← Dashboard
          </button>
          <h1 className="text-3xl font-bold text-letterboxd-text-primary">
            Refresh user film data
          </h1>
          <p className="text-letterboxd-text-secondary text-sm mt-1">
            Re-scrape every user's Letterboxd film grid, then refresh Letterboxd
            average ratings for any newly-seen films.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void trigger()}
            disabled={isRunning || isTriggering}
            className="btn-primary"
          >
            {isTriggering ? "Starting…" : "Run refresh"}
          </button>
          {isRunning && (
            <button
              type="button"
              onClick={() => void cancel()}
              disabled={isCancelling}
              className="btn-secondary"
            >
              {isCancelling ? "Cancelling…" : "Cancel"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="card border border-red-500/40">
          <p className="text-red-400 font-semibold">Error</p>
          <p className="text-letterboxd-text-primary text-sm mt-1">{error}</p>
        </div>
      )}

      {!job && !error && (
        <div className="card text-center py-12">
          <p className="text-letterboxd-text-secondary">
            No active refresh job. Click "Run refresh" to start one.
          </p>
        </div>
      )}

      {job && (
        <>
          <div className="card">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg font-semibold text-letterboxd-text-primary">
                Current job
              </h2>
              <span
                className={
                  "text-xs uppercase tracking-wide px-2 py-1 rounded " +
                  statusBadge(job.status).cls
                }
              >
                {statusBadge(job.status).text}
              </span>
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <dt className="text-letterboxd-text-secondary">Job id</dt>
              <dd className="font-mono text-xs">{job.id}</dd>
              <dt className="text-letterboxd-text-secondary">Started</dt>
              <dd>{new Date(job.started_at).toLocaleString()}</dd>
              <dt className="text-letterboxd-text-secondary">Finished</dt>
              <dd>
                {job.finished_at
                  ? new Date(job.finished_at).toLocaleString()
                  : "—"}
              </dd>
            </dl>
          </div>

          <div className="space-y-2">
            {PHASE_ORDER.map(({ key, label }) => (
              <PhaseRow key={key} job={job} phase={key} label={label} />
            ))}
          </div>

          <ErrorsPanel errors={job.errors} />

          {job.log_tail && (
            <div className="card">
              <h2 className="text-lg font-semibold text-letterboxd-text-primary mb-2">
                Log
              </h2>
              <pre className="text-xs font-mono whitespace-pre-wrap max-h-64 overflow-y-auto bg-letterboxd-bg-primary p-3 rounded">
                {job.log_tail}
              </pre>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default AdminRefresh;
