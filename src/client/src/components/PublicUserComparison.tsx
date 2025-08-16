import React, { useState, useEffect } from "react";
import apiService from "../services/api";

interface Rating {
  rating: number;
  count: number;
}

interface UserData {
  username: string;
  displayName?: string;
  followers?: number;
  following?: number;
  numberOfLists?: number;
  totalFilms?: number;
  ratings: Rating[];
}

const PublicUserComparison: React.FC = () => {
  const [usernames, setUsernames] = useState<Array<{ username: string; displayName?: string }>>([]);
  const [selectedUser1, setSelectedUser1] = useState<string>("");
  const [selectedUser2, setSelectedUser2] = useState<string>("");
  const [user1Data, setUser1Data] = useState<UserData | null>(null);
  const [user2Data, setUser2Data] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Load usernames on component mount
  useEffect(() => {
    loadUsernames();
  }, []);

  const loadUsernames = async () => {
    try {
      setLoading(true);
      setError(null);
      // Use new database-first endpoint
      const response = await apiService.getFilmUsers();
      if (response.data) {
        setUsernames(response.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load usernames");
    } finally {
      setLoading(false);
    }
  };

  const loadUserRatings = async (username: string, isUser1: boolean) => {
    if (!username) return;

    try {
      setLoading(true);
      setError(null);
      // Use new database-first endpoint with fallback to scraping if needed
      const response = await apiService.getFilmUserComplete(username, true);

      if (response.data) {
        const userData: UserData = {
          username: response.data.username,
          displayName: response.data.displayName,
          followers: response.data.followers,
          following: response.data.following,
          numberOfLists: response.data.numberOfLists,
          totalFilms: response.data.totalRatings,
          ratings: response.data.ratings,
        };

        if (isUser1) {
          setUser1Data(userData);
        } else {
          setUser2Data(userData);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load user ratings"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUser1Change = (username: string) => {
    setSelectedUser1(username);
    if (username) {
      loadUserRatings(username, true);
    } else {
      setUser1Data(null);
    }
  };

  const handleUser2Change = (username: string) => {
    setSelectedUser2(username);
    if (username) {
      loadUserRatings(username, false);
    } else {
      setUser2Data(null);
    }
  };

  const getRatingCount = (
    userData: UserData | null,
    rating: number
  ): number => {
    if (!userData) return 0;
    const ratingItem = userData.ratings.find((r) => r.rating === rating);
    return ratingItem ? ratingItem.count : 0;
  };

  const isHigherCount = (count1: number, count2: number): boolean => {
    return count1 > count2;
  };

  const renderStars = (rating: number): string => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      "★".repeat(fullStars) + (hasHalfStar ? "½" : "") + "☆".repeat(emptyStars)
    );
  };

  const allRatings = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5];

  return (
    <div className="min-h-screen bg-letterboxd-bg-primary">
      <header className="bg-letterboxd-bg-secondary border-b border-letterboxd-border px-6 py-4">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-letterboxd-text-primary">
            BPDiscord
          </h1>
          <div className="flex items-center space-x-4">
            <a
              href="/"
              className="text-letterboxd-text-secondary hover:text-letterboxd-text-primary transition-colors duration-200"
            >
              Home
            </a>
            <a href="/login" className="btn-secondary">
              Login
            </a>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center">
            <h2 className="text-3xl font-bold text-letterboxd-text-primary mb-2">
              User Comparison
            </h2>
            <p className="text-letterboxd-text-secondary">
              Compare rating statistics between two Letterboxd users
            </p>
          </div>

          {/* User Selection */}
          <div className="card">
            <h3 className="text-xl font-semibold text-letterboxd-text-primary mb-4">
              Select Users to Compare
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* User 1 Selection */}
              <div>
                <label className="block text-sm font-medium text-letterboxd-text-secondary mb-2">
                  User 1
                </label>
                <select
                  value={selectedUser1}
                  onChange={(e) => handleUser1Change(e.target.value)}
                  disabled={loading}
                  className="input-field w-full"
                >
                  <option value="">Select a user</option>
                  {usernames.map((user) => (
                    <option key={user.username} value={user.username}>
                      {user.displayName || user.username}
                    </option>
                  ))}
                </select>
              </div>

              {/* User 2 Selection */}
              <div>
                <label className="block text-sm font-medium text-letterboxd-text-secondary mb-2">
                  User 2
                </label>
                <select
                  value={selectedUser2}
                  onChange={(e) => handleUser2Change(e.target.value)}
                  disabled={loading}
                  className="input-field w-full"
                >
                  <option value="">Select a user</option>
                  {usernames.map((user) => (
                    <option key={user.username} value={user.username}>
                      {user.displayName || user.username}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {error && (
            <div className="card border-red-500/30 bg-red-900/10">
              <h3 className="text-lg font-semibold text-red-400 mb-2">Error</h3>
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {/* Comparison Table */}
          {(user1Data || user2Data) && (
            <div className="card">
              <h3 className="text-xl font-semibold text-letterboxd-text-primary mb-4">
                Rating Comparison
              </h3>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-letterboxd-border">
                      <th className="text-left py-3 px-4 text-letterboxd-text-secondary font-medium">
                        Rating
                      </th>
                      <th className="text-left py-3 px-4 text-letterboxd-text-secondary font-medium">
                        {user1Data?.displayName || user1Data?.username || "User 1"}
                      </th>
                      <th className="text-left py-3 px-4 text-letterboxd-text-secondary font-medium">
                        {user2Data?.displayName || user2Data?.username || "User 2"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {allRatings.map((rating) => {
                      const count1 = getRatingCount(user1Data, rating);
                      const count2 = getRatingCount(user2Data, rating);
                      const isUser1Higher = isHigherCount(count1, count2);
                      const isUser2Higher = isHigherCount(count2, count1);

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
                          <td
                            className={`py-3 px-4 text-letterboxd-text-primary ${
                              isUser1Higher ? "bg-green-900/20" : ""
                            }`}
                          >
                            {count1}
                          </td>
                          <td
                            className={`py-3 px-4 text-letterboxd-text-primary ${
                              isUser2Higher ? "bg-green-900/20" : ""
                            }`}
                          >
                            {count2}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Summary */}
              {user1Data && user2Data && (
                <div className="mt-6 p-4 bg-letterboxd-bg-primary rounded-lg">
                  <h4 className="text-lg font-semibold text-letterboxd-text-primary mb-3">
                    Summary
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-medium text-letterboxd-text-secondary mb-2">
                        {user1Data.displayName || user1Data.username}
                      </h5>
                      <p className="text-sm text-letterboxd-text-muted">
                        Total films rated:{" "}
                        {user1Data.totalFilms || user1Data.ratings.reduce((sum, r) => sum + r.count, 0)}
                      </p>
                    </div>
                    <div>
                      <h5 className="font-medium text-letterboxd-text-secondary mb-2">
                        {user2Data.displayName || user2Data.username}
                      </h5>
                      <p className="text-sm text-letterboxd-text-muted">
                        Total films rated:{" "}
                        {user2Data.totalFilms || user2Data.ratings.reduce((sum, r) => sum + r.count, 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Instructions */}
          {!user1Data && !user2Data && (
            <div className="card">
              <div className="text-center py-8">
                <p className="text-letterboxd-text-secondary">
                  Select two users from the dropdowns above to compare their
                  rating statistics.
                </p>
                <p className="text-sm text-letterboxd-text-muted mt-2">
                  Higher counts will be highlighted in green.
                </p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PublicUserComparison;
