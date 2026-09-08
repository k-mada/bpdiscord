import { Link } from "react-router-dom";

import { useRefreshJob } from "../hooks/useRefreshJob";
import JobProgress from "./JobProgress";
import { Button, buttonVariants } from "./ui/Button";
import { Notification } from "./ui/Notification";
import { cn } from "../lib/utils";

const AdminRefresh = () => {
  const { job, error, isTriggering, isCancelling, trigger, cancel } =
    useRefreshJob();

  const isRunning = job?.status === "running";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link
            to="/dashboard"
            className={cn(buttonVariants({ variant: "ghost" }), "p-0 text-sm mb-2")}
          >
            ← Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-letterboxd-text-primary">
            Refresh user film data
          </h1>
          <p className="text-letterboxd-text-secondary text-sm mt-1">
            Re-scrape every user's Letterboxd film grid, then refresh Letterboxd
            average ratings for any newly-seen films.
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            type="button"
            onClick={() => void trigger()}
            disabled={isRunning}
            loading={isTriggering}
          >
            Run refresh
          </Button>
          {isRunning && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => void cancel()}
              loading={isCancelling}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>

      {error && (
        <Notification status={{ type: "error", message: error }} />
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
