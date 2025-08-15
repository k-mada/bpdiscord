import React, { useState } from "react";
import apiService from "../services/api";

interface Rating {
  rating: number;
  count: number;
}

interface UserData {
  username: string;
  ratings: Rating[];
}

interface ScraperInterfaceProps {
  token: string;
}

const ScraperInterface: React.FC<ScraperInterfaceProps> = ({ token }) => {
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<string>("");
  const [userRatings, setUserRatings] = useState<UserData | null>(null);
  const [filmCount, setFilmCount] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const renderStars = (rating: number): string => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      "★".repeat(fullStars) + (hasHalfStar ? "½" : "") + "☆".repeat(emptyStars)
    );
  };

  const allRatings = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

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
      // Fetch user ratings
      setFetchStatus("Fetching user ratings...");
      const ratingsResponse = await apiService.getUserRatings(username, token);

      if (ratingsResponse.error) {
        throw new Error(`User ratings fetch failed: ${ratingsResponse.error}`);
      }

      // Fetch all films
      setFetchStatus("Fetching user's films...");
      const filmsResponse = await apiService.getAllFilms(username, token);

      if (filmsResponse.error) {
        throw new Error(`Films fetch failed: ${filmsResponse.error}`);
      }

      // Process user ratings data
      if (ratingsResponse.data && ratingsResponse.data.ratings) {
        setUserRatings({
          username: username,
          ratings: ratingsResponse.data.ratings,
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

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h2 className="text-3xl font-bold text-letterboxd-text-primary mb-2">
          Letterboxd Data Fetcher
        </h2>
        <p className="text-letterboxd-text-secondary">
          Fetch all user data and film information
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
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter Letterboxd username"
              disabled={loading}
              className="input-field w-full"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4">
            <button
              onClick={handleFetchAllData}
              disabled={loading || !username.trim()}
              className="btn-primary flex-1"
            >
              {loading ? "Fetching..." : "Fetch All User Data"}
            </button>
          </div>

          {fetchStatus && (
            <div className="mt-4 p-3 bg-letterboxd-bg-primary rounded-lg border border-letterboxd-border">
              <p className="text-letterboxd-text-secondary text-sm">
                {fetchStatus}
              </p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="card border-red-500/30 bg-red-900/10">
          <h3 className="text-lg font-semibold text-red-400 mb-2">Error</h3>
          <p className="text-red-300">{error}</p>
        </div>
      )}

      {success && (
        <div className="card border-green-500/30 bg-green-900/10">
          <h3 className="text-lg font-semibold text-green-400 mb-2">Success</h3>
          <p className="text-green-300">{success}</p>
        </div>
      )}

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
                {allRatings.map((rating) => {
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

      {/* Films Count */}
      {filmCount !== null && (
        <div className="card">
          <h3 className="text-xl font-semibold text-letterboxd-text-primary mb-4">
            Films Data
          </h3>
          <p className="text-letterboxd-text-primary">
            {filmCount} films fetched
          </p>
        </div>
      )}
    </div>
  );
};

export default ScraperInterface;
