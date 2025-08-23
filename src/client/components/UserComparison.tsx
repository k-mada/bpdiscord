import React, { useState, useEffect } from "react";
import apiService from "../services/api";
import RatingDistributionHistogram from "./RatingDistributionHistogram";
import TasteCompatibility from "./TasteCompatibility";
import Header from "./Header";

interface UserComparisonProps {
  onBackToProfile?: () => void;
}

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

interface MovieInCommon {
  title: string;
  user1_rating: number;
  user2_rating: number;
}

interface MoviesInCommonData {
  user1: string;
  user2: string;
  moviesInCommon: MovieInCommon[];
  count: number;
}

const UserComparison: React.FC<UserComparisonProps> = ({ onBackToProfile }) => {
  const [usernames, setUsernames] = useState<
    Array<{ username: string; displayName?: string }>
  >([]);
  const [selectedUser1, setSelectedUser1] = useState<string>("");
  const [selectedUser2, setSelectedUser2] = useState<string>("");
  const [user1Data, setUser1Data] = useState<UserData | null>(null);
  const [user2Data, setUser2Data] = useState<UserData | null>(null);
  const [moviesInCommonData, setMoviesInCommonData] =
    useState<MoviesInCommonData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMovies, setLoadingMovies] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterNonRated, setFilterNonRated] = useState(false);

  // Load usernames on component mount
  useEffect(() => {
    loadUsernames();
  }, []);

  const onFilterNonRatedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilterNonRated(e.target.checked);
  };

  // Load movies in common when both users are selected
  useEffect(() => {
    if (selectedUser1 && selectedUser2 && selectedUser1 !== selectedUser2) {
      loadMoviesInCommon();
    } else {
      setMoviesInCommonData(null);
    }
  }, [selectedUser1, selectedUser2]);

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

  const loadMoviesInCommon = async () => {
    if (!selectedUser1 || !selectedUser2) return;

    try {
      setLoadingMovies(true);
      setError(null);
      const response = await apiService.getMoviesInCommon(
        selectedUser1,
        selectedUser2
      );
      if (response.data) {
        setMoviesInCommonData(response.data);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load movies in common"
      );
    } finally {
      setLoadingMovies(false);
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
    if (!username) {
      setUser1Data(null);
    }
  };

  const handleUser2Change = (username: string) => {
    setSelectedUser2(username);
    if (!username) {
      setUser2Data(null);
    }
  };

  // Load user data for both users when both are selected
  useEffect(() => {
    if (selectedUser1 && selectedUser2 && selectedUser1 !== selectedUser2) {
      loadUserRatings(selectedUser1, true);
      loadUserRatings(selectedUser2, false);
    } else {
      if (!selectedUser1) setUser1Data(null);
      if (!selectedUser2) setUser2Data(null);
    }
  }, [selectedUser1, selectedUser2]);

  const getRatingCount = (
    userData: UserData | null,
    rating: number
  ): number => {
    if (!userData) return 0;
    const ratingItem = userData.ratings.find((r) => r.rating === rating);
    return ratingItem ? ratingItem.count : 0;
  };

  const getTotalRatings = (userData: UserData | null): number => {
    if (!userData) return 0;
    return userData.ratings.reduce((sum, r) => sum + r.count, 0);
  };

  const calculateAverageRating = (userData: UserData | null): number => {
    if (!userData || userData.ratings.length === 0) return 0;

    const totalWeightedRating = userData.ratings.reduce(
      (sum, r) => sum + r.rating * r.count,
      0
    );
    const totalCount = getTotalRatings(userData);

    return totalCount > 0 ? totalWeightedRating / totalCount : 0;
  };

  const getRatingPercentage = (
    userData: UserData | null,
    rating: number
  ): number => {
    const count = getRatingCount(userData, rating);
    const total = getTotalRatings(userData);
    return total > 0 ? (count / total) * 100 : 0;
  };

  const isHigherCount = (count1: number, count2: number): boolean => {
    return count1 > count2;
  };

  const StarRating: React.FC<{ rating: number }> = ({ rating }) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="flex items-center">
        {/* Full stars */}
        {Array.from({ length: fullStars }, (_, i) => (
          <span key={`full-${i}`} className="text-letterboxd-accent text-lg">
            ★
          </span>
        ))}

        {/* Half star */}
        {hasHalfStar && (
          <div key="half" className="relative inline-block text-lg">
            <span className="text-letterboxd-border">☆</span>
            <span
              className="absolute inset-0 text-letterboxd-accent overflow-hidden"
              style={{ width: "50%" }}
            >
              ★
            </span>
          </div>
        )}

        {/* Empty stars */}
        {Array.from({ length: emptyStars }, (_, i) => (
          <span key={`empty-${i}`} className="text-letterboxd-border text-lg">
            ☆
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-letterboxd-bg-primary">
      <Header />
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

          {/* Loading state for movies */}
          {loadingMovies && (
            <div className="card">
              <div className="text-center py-8">
                <p className="text-letterboxd-text-secondary">
                  Loading movies in common...
                </p>
              </div>
            </div>
          )}
          {/* Profile Comparison */}
          {(user1Data || user2Data) && (
            <div className="card">
              <h3 className="text-xl font-semibold text-letterboxd-text-primary mb-4">
                Profile Comparison
              </h3>

              <div className="overflow-x-auto mb-8">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-letterboxd-border">
                      <th className="text-left py-3 px-4 text-letterboxd-text-secondary font-medium">
                        Metric
                      </th>
                      <th className="text-left py-3 px-4 text-letterboxd-text-secondary font-medium">
                        {user1Data?.displayName ||
                          user1Data?.username ||
                          "User 1"}
                      </th>
                      <th className="text-left py-3 px-4 text-letterboxd-text-secondary font-medium">
                        {user2Data?.displayName ||
                          user2Data?.username ||
                          "User 2"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-letterboxd-border/50">
                      <td className="py-3 px-4 text-letterboxd-text-primary font-medium">
                        Total Films Rated
                      </td>
                      <td
                        className={`py-3 px-4 text-letterboxd-text-primary ${
                          (user1Data?.totalFilms || 0) >
                          (user2Data?.totalFilms || 0)
                            ? "bg-green-900/20"
                            : ""
                        }`}
                      >
                        {user1Data?.totalFilms || 0}
                      </td>
                      <td
                        className={`py-3 px-4 text-letterboxd-text-primary ${
                          (user2Data?.totalFilms || 0) >
                          (user1Data?.totalFilms || 0)
                            ? "bg-green-900/20"
                            : ""
                        }`}
                      >
                        {user2Data?.totalFilms || 0}
                      </td>
                    </tr>
                    <tr className="border-b border-letterboxd-border/50">
                      <td className="py-3 px-4 text-letterboxd-text-primary font-medium">
                        Followers
                      </td>
                      <td
                        className={`py-3 px-4 text-letterboxd-text-primary ${
                          (user1Data?.followers || 0) >
                          (user2Data?.followers || 0)
                            ? "bg-green-900/20"
                            : ""
                        }`}
                      >
                        {user1Data?.followers?.toLocaleString() || 0}
                      </td>
                      <td
                        className={`py-3 px-4 text-letterboxd-text-primary ${
                          (user2Data?.followers || 0) >
                          (user1Data?.followers || 0)
                            ? "bg-green-900/20"
                            : ""
                        }`}
                      >
                        {user2Data?.followers?.toLocaleString() || 0}
                      </td>
                    </tr>
                    <tr className="border-b border-letterboxd-border/50">
                      <td className="py-3 px-4 text-letterboxd-text-primary font-medium">
                        Following
                      </td>
                      <td
                        className={`py-3 px-4 text-letterboxd-text-primary ${
                          (user1Data?.following || 0) >
                          (user2Data?.following || 0)
                            ? "bg-green-900/20"
                            : ""
                        }`}
                      >
                        {user1Data?.following?.toLocaleString() || 0}
                      </td>
                      <td
                        className={`py-3 px-4 text-letterboxd-text-primary ${
                          (user2Data?.following || 0) >
                          (user1Data?.following || 0)
                            ? "bg-green-900/20"
                            : ""
                        }`}
                      >
                        {user2Data?.following?.toLocaleString() || 0}
                      </td>
                    </tr>
                    <tr className="border-b border-letterboxd-border/50">
                      <td className="py-3 px-4 text-letterboxd-text-primary font-medium">
                        Lists Created
                      </td>
                      <td
                        className={`py-3 px-4 text-letterboxd-text-primary ${
                          (user1Data?.numberOfLists || 0) >
                          (user2Data?.numberOfLists || 0)
                            ? "bg-green-900/20"
                            : ""
                        }`}
                      >
                        {user1Data?.numberOfLists || 0}
                      </td>
                      <td
                        className={`py-3 px-4 text-letterboxd-text-primary ${
                          (user2Data?.numberOfLists || 0) >
                          (user1Data?.numberOfLists || 0)
                            ? "bg-green-900/20"
                            : ""
                        }`}
                      >
                        {user2Data?.numberOfLists || 0}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Rating Distribution Comparison */}
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
                        User
                      </th>
                      <th className="text-left py-3 px-4 text-letterboxd-text-secondary font-medium">
                        Number Movies Rated
                      </th>
                      <th className="text-left py-3 px-4 text-letterboxd-text-secondary font-medium">
                        Distribution
                      </th>
                      <th className="text-left py-3 px-4 text-letterboxd-text-secondary font-medium">
                        Average Rating
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {user1Data && (
                      <tr className="border-b border-letterboxd-border/50">
                        <td className="py-3 px-4 text-letterboxd-text-primary font-medium">
                          {user1Data.displayName || user1Data.username}
                        </td>
                        <td className="py-3 px-4 text-letterboxd-text-primary">
                          {getTotalRatings(user1Data).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <RatingDistributionHistogram
                            distribution={user1Data.ratings}
                          />
                        </td>
                        <td className="py-3 px-4 text-letterboxd-text-primary">
                          {calculateAverageRating(user1Data).toFixed(2)} / 5.0
                        </td>
                      </tr>
                    )}
                    {user2Data && (
                      <tr className="border-b border-letterboxd-border/50">
                        <td className="py-3 px-4 text-letterboxd-text-primary font-medium">
                          {user2Data.displayName || user2Data.username}
                        </td>
                        <td className="py-3 px-4 text-letterboxd-text-primary">
                          {getTotalRatings(user2Data).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          <RatingDistributionHistogram
                            distribution={user2Data.ratings}
                          />
                        </td>
                        <td className="py-3 px-4 text-letterboxd-text-primary">
                          {calculateAverageRating(user2Data).toFixed(2)} / 5.0
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Rating Legend */}
              <div className="mt-4 text-center">
                <p className="text-xs text-letterboxd-text-muted">
                  Hover over distribution bars to see detailed rating
                  information
                </p>
              </div>
            </div>
          )}

          {/* Movies in Common */}
          {moviesInCommonData && (
            <div className="card">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-xl font-semibold text-letterboxd-text-primary">
                  Movies in Common
                </h3>
                {/* <TasteCompatibility
                  user1Data={user1Data}
                  user2Data={user2Data}
                  moviesInCommon={moviesInCommonData.moviesInCommon}
                /> */}
              </div>

              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <input
                    id="chkFilterNonRated"
                    type="checkbox"
                    checked={filterNonRated}
                    onChange={() => setFilterNonRated(!filterNonRated)}
                  />
                  <label htmlFor="chkFilterNonRated">
                    Hide non-rated movies
                  </label>
                </div>
                <p className="text-letterboxd-text-secondary">
                  <span className="text-letterboxd-accent font-semibold">
                    {moviesInCommonData.count}
                  </span>{" "}
                  movies watched by both{" "}
                  <span className="text-letterboxd-text-primary font-medium">
                    {user1Data?.displayName || moviesInCommonData.user1}
                  </span>{" "}
                  and{" "}
                  <span className="text-letterboxd-text-primary font-medium">
                    {user2Data?.displayName || moviesInCommonData.user2}
                  </span>
                </p>
                {filterNonRated && (
                  <p className="text-letterboxd-text-secondary">
                    <span className="text-letterboxd-accent font-semibold">
                      (Only displaying movies that have been rated by both
                      users)
                    </span>{" "}
                  </p>
                )}
              </div>

              {moviesInCommonData.count > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-letterboxd-border">
                        <th className="text-left py-3 px-4 text-letterboxd-text-secondary font-medium">
                          Movie Title
                        </th>
                        <th className="text-left py-3 px-4 text-letterboxd-text-secondary font-medium">
                          {user1Data?.displayName || moviesInCommonData.user1}
                        </th>
                        <th className="text-left py-3 px-4 text-letterboxd-text-secondary font-medium">
                          {user2Data?.displayName || moviesInCommonData.user2}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {moviesInCommonData.moviesInCommon.map((movie, index) => {
                        const hasNonRating =
                          movie.user1_rating === 0 || movie.user2_rating === 0;
                        const shouldShow = filterNonRated
                          ? !hasNonRating
                          : true;

                        return (
                          shouldShow && (
                            <tr
                              key={`${movie.title}-${index}`}
                              className="border-b border-letterboxd-border/50"
                            >
                              <td className="py-3 px-4 text-letterboxd-text-primary font-medium">
                                {movie.title}
                              </td>
                              <td className="py-3 px-4 text-letterboxd-text-primary">
                                {movie.user1_rating > 0 ? (
                                  <StarRating rating={movie.user1_rating} />
                                ) : (
                                  <span className="text-letterboxd-text-muted italic">
                                    not rated
                                  </span>
                                )}
                              </td>
                              <td className="py-3 px-4 text-letterboxd-text-primary">
                                {movie.user2_rating > 0 ? (
                                  <StarRating rating={movie.user2_rating} />
                                ) : (
                                  <span className="text-letterboxd-text-muted italic">
                                    not rated
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {moviesInCommonData.count === 0 && (
                <div className="text-center py-8">
                  <p className="text-letterboxd-text-muted">
                    No movies in common found between these users.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Loading state for movies */}
          {loadingMovies && (
            <div className="card">
              <div className="text-center py-8">
                <p className="text-letterboxd-text-secondary">
                  Loading movies in common...
                </p>
              </div>
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

export default UserComparison;
