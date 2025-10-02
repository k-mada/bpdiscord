import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import apiService from "../services/api";
import { ALL_RATINGS } from "../constants";
import Header from "./Header";

interface Rating {
  rating: number;
  count: number;
}

interface UserData {
  username: string;
  ratings: Rating[];
}

const ScraperInterface = () => {
  const navigate = useNavigate();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = localStorage.getItem("token");
    if (storedToken) {
      setToken(storedToken);
    }
  }, []);

  // Load available users on component mount
  useEffect(() => {
    const loadAvailableUsers = async () => {
      try {
        setLoadingUsers(true);
        const response = await apiService.getFilmUsers();
        if (response.data) {
          setAvailableUsers(response.data);
        }
      } catch (err) {
        console.error("Failed to load available users:", err);
        // Fallback to empty array if loading fails
        setAvailableUsers([]);
      } finally {
        setLoadingUsers(false);
      }
    };

    loadAvailableUsers();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<string>("");
  const [userRatings, setUserRatings] = useState<UserData | null>(null);
  const [filmCount, setFilmCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // SSE streaming states
  const [streaming, setStreaming] = useState(false);
  const [streamProgress, setStreamProgress] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(0);
  const [totalPages, setTotalPages] = useState<number>(0);
  const [totalFilmsCollected, setTotalFilmsCollected] = useState<number>(0);

  // Available users for dropdown
  const [availableUsers, setAvailableUsers] = useState<
    Array<{ username: string; displayName?: string }>
  >([]);
  const [loadingUsers, setLoadingUsers] = useState(true);

  const renderStars = (rating: number): string => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      "★".repeat(fullStars) + (hasHalfStar ? "½" : "") + "☆".repeat(emptyStars)
    );
  };

  const handleCheckExistingData = async () => {
    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setUserRatings(null);
    setFilmCount(null);

    try {
      setFetchStatus("Checking database for existing data...");
      const response = await apiService.getFilmUserComplete(username, false);

      if (response.data) {
        setUserRatings({
          username: username,
          ratings: response.data.ratings,
        });
        setSuccess("Data found in database!");
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes("404")) {
        setError(
          "No data found in database. Use 'Force Scrape' to collect data."
        );
      } else {
        setError(
          err instanceof Error ? err.message : "Failed to check existing data"
        );
      }
    } finally {
      setFetchStatus("");
      setLoading(false);
    }
  };

  const handleFetchAllData = async () => {
    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);
    setUserRatings(null);
    setFilmCount(null);

    try {
      // Force scrape user profile and ratings
      setFetchStatus("Force scraping user profile and ratings...");
      const profileResponse = await apiService.forceScrapeUserProfile(
        username,
        token
      );

      if (profileResponse.error) {
        throw new Error(
          `User profile scraping failed: ${profileResponse.error}`
        );
      }

      // Fetch all films
      setFetchStatus("Fetching user's films...");
      const filmsResponse = await apiService.getAllFilms(username, token);

      if (filmsResponse.error) {
        throw new Error(`Films fetch failed: ${filmsResponse.error}`);
      }

      // Process user ratings data
      if (profileResponse.data && profileResponse.data.ratings) {
        setUserRatings({
          username: username,
          ratings: profileResponse.data.ratings,
        });
      }

      // Process films data
      if (filmsResponse.data && filmsResponse.data.filmData) {
        const totalFilms = filmsResponse.data.filmData.flat().length;
        setFilmCount(totalFilms);
      }

      setSuccess("All data fetched successfully!");
      setFetchStatus("");
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      setFetchStatus("");
    } finally {
      setLoading(false);
    }
  };

  const handleStreamScraping = async () => {
    if (!username.trim()) {
      setError("Please enter a username");
      return;
    }

    setStreaming(true);
    setError(null);
    setSuccess(null);
    setUserRatings(null);
    setFilmCount(null);
    setStreamProgress([]);
    setCurrentPage(0);
    setTotalPages(0);
    setTotalFilmsCollected(0);

    try {
      const eventSource = new EventSource(
        `/api/scraper/stream-films/${encodeURIComponent(username)}`,
        {
          withCredentials: false,
        }
      );

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(data);
          // Add to progress log (excluding heartbeat events)
          if (data.type !== "heartbeat") {
            setStreamProgress((prev) => [...prev, data]);
          }

          switch (data.type) {
            case "start":
            case "init":
              setFetchStatus(data.message);
              break;

            case "browser_launch":
              setFetchStatus(data.message);
              break;

            case "fetching_first_page":
              setFetchStatus(data.message);
              break;

            case "pages_found":
              setTotalPages(data.totalPages);
              setFetchStatus(`Found ${data.totalPages} pages to fetch`);
              break;

            case "production_limit":
              setFetchStatus(data.message);
              break;

            case "page_loading":
            case "page_loaded":
            case "page_retry":
              setFetchStatus(data.message);
              break;

            case "page_start":
              setCurrentPage(data.currentPage);
              setFetchStatus(
                `Fetching page ${data.currentPage} of ${data.totalPages}...`
              );
              break;

            case "page_scraped":
              setFetchStatus(
                `Fetched ${data.filmsFromPage} films from page ${data.page}`
              );
              break;

            case "page_complete":
              setTotalFilmsCollected(data.filmsCollectedSoFar);
              setFetchStatus(
                `Page ${data.currentPage} complete - ${data.filmsCollectedSoFar} total films`
              );
              break;

            case "page_error":
              setFetchStatus(data.message);
              break;

            case "scraping_complete":
              setFetchStatus(
                `Fetching complete! ${data.totalFilms} films collected`
              );
              break;

            case "saving":
              setFetchStatus(data.message);
              break;

            case "scraping_ratings":
              setFetchStatus(data.message);
              break;

            case "saving_ratings":
              setFetchStatus(data.message);
              break;

            case "ratings_complete":
              setFetchStatus(data.message);
              break;

            case "ratings_warning":
              setFetchStatus(data.message);
              break;

            case "complete":
              setFilmCount(data.data.totalFilms);
              setSuccess(
                `Successfully updated ${data.data.totalFilms} films and user ratings!`
              );
              setFetchStatus(
                `Operation completed! ${data.data.totalFilms} films and ratings updated`
              );
              eventSource.close();
              setStreaming(false);
              break;

            case "error":
              // Handle specific error codes
              if (data.code === "NAVIGATION_TIMEOUT") {
                setError(
                  `${data.message} This is usually temporary - please try again in a few minutes.`
                );
              } else if (data.code === "PRODUCTION_TIMEOUT") {
                setError(
                  `${data.message} The operation was automatically stopped to prevent server overload.`
                );
              } else {
                setError(data.message);
              }
              setFetchStatus("");
              eventSource.close();
              setStreaming(false);
              break;

            case "heartbeat":
              // Keep connection alive, don't update UI
              break;

            default:
              console.log("Unknown SSE event type:", data.type, data);
              break;
          }
        } catch (parseError) {
          console.error("Error parsing SSE data:", parseError);
        }
      };

      eventSource.onerror = (event) => {
        console.error("SSE Error:", event);
        setError("Connection error during streaming");
        setFetchStatus("");
        eventSource.close();
        setStreaming(false);
      };

      // Cleanup function
      return () => {
        eventSource.close();
        setStreaming(false);
      };
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      setFetchStatus("");
      setStreaming(false);
    }
  };

  return (
    <div className="min-h-screen bg-letterboxd-bg-primary">
      <Header />
      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          <div className="text-center">
            <h2 className="text-3xl font-bold text-letterboxd-text-primary mb-2">
              Letterboxd Data Fetcher
            </h2>
            <p className="text-letterboxd-text-secondary">
              Check database for existing data or fetch latest data from
              Letterboxd
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
                    disabled={loading || streaming}
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
                  onClick={handleCheckExistingData}
                  disabled={loading || streaming || !username.trim()}
                  className="btn-secondary flex-1"
                >
                  {loading ? "Checking..." : "Check current ratings data"}
                </button>
                {/* <button
              onClick={handleFetchAllData}
              disabled={loading || streaming || !username.trim()}
              className="btn-primary flex-1"
            >
              {loading ? "Scraping..." : "Force Scrape Data"}
            </button> */}
                <button
                  onClick={handleStreamScraping}
                  disabled={loading || streaming || !username.trim()}
                  className="btn-primary flex-1"
                >
                  {streaming ? "Getting films..." : "Update films"}
                </button>
              </div>
              {error && (
                <div className="card border-red-500/30 bg-red-900/10">
                  <h3 className="text-lg font-semibold text-red-400 mb-2">
                    Error
                  </h3>
                  <p className="text-red-300">{error}</p>
                </div>
              )}

              {success && (
                <div className="card border-green-500/30 bg-green-900/10">
                  <h3 className="text-lg font-semibold text-green-400 mb-2">
                    Success
                  </h3>
                  <p className="text-green-300">{success}</p>
                </div>
              )}
              {fetchStatus && (
                <div className="mt-4 p-3 bg-letterboxd-bg-primary rounded-lg border border-letterboxd-border">
                  <p className="text-letterboxd-text-secondary text-sm">
                    {fetchStatus}
                  </p>
                </div>
              )}

              {/* Progress Bar for Streaming */}
              {streaming && totalPages > 0 && (
                <div className="mt-4 p-4 bg-letterboxd-bg-secondary rounded-lg border border-letterboxd-border">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm text-letterboxd-text-secondary">
                      <span>Page Progress</span>
                      <span>
                        {currentPage} / {totalPages}
                      </span>
                    </div>
                    <div className="w-full bg-letterboxd-bg-primary rounded-full h-2">
                      <div
                        className="bg-letterboxd-accent h-2 rounded-full transition-all duration-300"
                        style={{
                          width: `${(currentPage / totalPages) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-letterboxd-text-muted">
                      <span>Films collected: {totalFilmsCollected}</span>
                      <span>
                        {Math.round((currentPage / totalPages) * 100)}% complete
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Live Progress Log */}
              {streamProgress.length > 0 && (
                <div className="mt-4 p-4 bg-letterboxd-bg-secondary rounded-lg border border-letterboxd-border">
                  <h4 className="text-sm font-semibold text-letterboxd-text-secondary mb-3">
                    {streaming ? "Live Progress Log" : "Operation Log"}
                  </h4>
                  <div className="max-h-80 overflow-y-auto space-y-1">
                    {streamProgress
                      .slice()
                      .reverse()
                      .map((progress, index) => (
                        <div
                          key={index}
                          className="text-xs text-letterboxd-text-muted p-2 bg-letterboxd-bg-primary rounded"
                        >
                          <span className="text-letterboxd-text-secondary font-mono">
                            {new Date(progress.timestamp).toLocaleTimeString()}
                          </span>
                          {" - "}
                          <span
                            className={`${
                              progress.type === "error"
                                ? "text-red-400"
                                : progress.type === "complete"
                                ? "text-green-400"
                                : "text-letterboxd-text-muted"
                            }`}
                          >
                            {progress.message}
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* User Ratings Table */}
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
                        (r) => r.rating === rating
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
      </main>
    </div>
  );
};

export default ScraperInterface;
