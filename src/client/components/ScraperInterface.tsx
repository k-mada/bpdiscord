import { useState } from "react";

import apiService from "../services/api";
import { useComparison } from "../hooks/useComparison";
import { useScrapeJob } from "../hooks/useScrapeJob";
import JobProgress from "./JobProgress";
import RatingDistributionHistogram from "./RatingDistributionHistogram";
import CompatibilityExtremes from "./CompatibilityExtremes";
import { Button } from "./ui/Button";
import { Notification, Status } from "./ui/Notification";
interface Rating {
  rating: number;
  count: number;
}

interface UserData {
  username: string;
  ratings: Rating[];
}

const ScraperInterface = () => {
  const { usernames: availableUsers, loading: loadingUsers } = useComparison();

  const [username, setUsername] = useState("");
  const [userRatings, setUserRatings] = useState<UserData | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // job_id is persisted so a long scrape survives a refresh and can be
  // monitored from another tab.
  const {
    job,
    error: jobError,
    isTriggering,
    isCancelling,
    trigger,
    cancel,
  } = useScrapeJob();

  const isRunning = job?.status === "running";
  const buttonsDisabled = checkLoading || isTriggering || isRunning;

  const handleCheckExistingData = async () => {
    if (!username.trim()) {
      setCheckError("Please select a username");
      return;
    }
    setCheckLoading(true);
    setCheckError(null);
    setUserRatings(null);

    try {
      const response = await apiService.getFilmUserComplete(username);
      if (response.data) {
        setUserRatings({
          username,
          ratings: response.data.ratings,
        });
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) {
        setCheckError(
          "No data found in database. Use 'Update films' to scrape fresh data.",
        );
      } else {
        setCheckError(
          err instanceof Error ? err.message : "Failed to check existing data",
        );
      }
    } finally {
      setCheckLoading(false);
    }
  };

  const handleUpdateFilms = () => {
    if (!username.trim()) {
      setCheckError("Please select a username");
      return;
    }
    setCheckError(null);
    void trigger(username);
  };

  const errorBanner: Status = checkError
    ? { type: "error", message: checkError }
    : jobError
      ? { type: "error", message: jobError }
      : { type: "idle" };

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-letterboxd-text-primary mb-2">
          Letterboxd Data Fetcher
        </h2>
        <p className="text-letterboxd-text-secondary">
          Check what's in the database, or trigger a fresh scrape of one user's
          Letterboxd ratings and films.
        </p>
      </div>
      <div className="card">
        <div className="space-y-4">
          <div>
            <label
              htmlFor="username"
              className="block text-sm font-medium text-letterboxd-text-secondary mb-2"
            >
              Letterboxd Username
            </label>
            {loadingUsers ? (
              <div className="input-field w-full flex items-center justify-center">
                <span className="text-letterboxd-text-muted">
                  Loading users...
                </span>
              </div>
            ) : (
              <select
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={buttonsDisabled}
                className="input-field w-full"
              >
                <option value="">
                  {availableUsers.length > 0
                    ? "Select a user..."
                    : "No users available"}
                </option>
                {availableUsers.map((user) => (
                  <option key={user.username} value={user.username}>
                    {user.displayName || user.username} ({user.username})
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              type="button"
              variant="secondary"
              onClick={handleCheckExistingData}
              disabled={buttonsDisabled || !username.trim()}
              loading={checkLoading}
              className="flex-1"
            >
              Check current ratings data
            </Button>
            <Button
              type="button"
              onClick={handleUpdateFilms}
              disabled={buttonsDisabled || !username.trim()}
              loading={isTriggering}
              className="flex-1"
            >
              Update films
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
      </div>
      <Notification status={errorBanner} />
      {/* Live scrape job — same 3-phase progress as the admin bulk refresh. */}
      {job && <JobProgress job={job} />}
      {/* Snapshot of the user's current ratings, read from the database. */}
      {userRatings && (
        <>
          <div className="m-auto">
            <RatingDistributionHistogram
              distribution={userRatings.ratings}
              size="md"
            />
          </div>
          <CompatibilityExtremes username={userRatings.username} />
        </>
      )}
    </div>
  );
};

export default ScraperInterface;
