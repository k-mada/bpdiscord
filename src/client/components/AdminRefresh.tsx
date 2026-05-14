import { useNavigate } from "react-router-dom";

import { useRefreshJob } from "../hooks/useRefreshJob";
import JobProgress from "./JobProgress";

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

      {job && <JobProgress job={job} />}
    </div>
  );
};

export default AdminRefresh;
