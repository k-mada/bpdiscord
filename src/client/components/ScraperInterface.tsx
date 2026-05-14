import { useState } from "react";

import apiService from "../services/api";
import { ALL_RATINGS } from "../constants";
import { useComparison } from "../hooks/useComparison";
import { useScrapeJob } from "../hooks/useScrapeJob";
import JobProgress from "./JobProgress";

interface Rating {
  rating: number;
  count: number;
}

interface UserData {
  username: string;
  ratings: Rating[];
}

const renderStars = (rating: number): string => {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 !== 0;
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  return (
    "★".repeat(fullStars) + (hasHalfStar ? "½" : "") + "☆".repeat(emptyStars)
  );
};

const ScraperInterface = () => {
  const { usernames: availableUsers, loading: loadingUsers } = useComparison();

  const [username, setUsername] = useState("");
  const [userRatings, setUserRatings] = useState<UserData | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);
  const [checkError, setCheckError] = useState<string | null>(null);

  // Per-user scrape job lifecycle — owns trigger/poll/cancel, localStorage
  // resume, and terminal-state detection. The job_id is persisted across
  // refreshes so a long scrape can be monitored from another tab.
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
      const response = await apiService.getFilmUserComplete(username, false);
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
            <button
              type="button"
              onClick={handleCheckExistingData}
              disabled={buttonsDisabled || !username.trim()}
              className="btn-secondary flex-1"
            >
              {checkLoading ? "Checking..." : "Check current ratings data"}
            </button>
            <button
              type="button"
              onClick={handleUpdateFilms}
              disabled={buttonsDisabled || !username.trim()}
              className="btn-primary flex-1"
            >
              {isTriggering ? "Starting..." : "Update films"}
            </button>
            {isRunning && (
              <button
                type="button"
                onClick={() => void cancel()}
                disabled={isCancelling}
                className="btn-secondary"
              >
                {isCancelling ? "Cancelling..." : "Cancel"}
              </button>
            )}
          </div>
        </div>
      </div>

      {(checkError || jobError) && (
        <div className="card border-red-500/30 bg-red-900/10">
          <h3 className="text-lg font-semibold text-red-400 mb-2">Error</h3>
          <p className="text-red-300">{checkError ?? jobError}</p>
        </div>
      )}

      {/* Live scrape job — same 3-phase progress as the admin bulk refresh. */}
      {job && <JobProgress job={job} />}

      {/* Snapshot of the user's current ratings, read from the database. */}
      {userRatings && (
        <div className="card">
          <h3 className="text-xl font-semibold text-letterboxd-text-primary mb-4">
            User Ratings for {userRatings.username}
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-letterboxd-border">
                  <th className="text-left py-3 px-4 text-letterboxd-text-secondary font-medium">
                    Rating
                  </th>
                  <th className="text-left py-3 px-4 text-letterboxd-text-secondary font-medium">
                    Count
                  </th>
                </tr>
              </thead>
              <tbody>
                {ALL_RATINGS.map((rating) => {
                  const ratingItem = userRatings.ratings.find(
                    (r) => r.rating === rating,
                  );
                  const count = ratingItem ? ratingItem.count : 0;

                  return (
                    <tr
                      key={rating}
                      className="border-b border-letterboxd-border/50"
                    >
                      <td className="py-3 px-4 text-letterboxd-text-primary">
                        <span className="text-letterboxd-accent">
                          {renderStars(rating)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-letterboxd-text-primary">
                        {count}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="mt-4 p-4 bg-letterboxd-bg-primary rounded-lg">
            <p className="text-sm text-letterboxd-text-muted">
              Total films rated:{" "}
              {userRatings.ratings.reduce((sum, r) => sum + r.count, 0)}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScraperInterface;
