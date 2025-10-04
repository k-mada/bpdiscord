import React, { useState, useEffect } from "react";
import apiService from "../services/api";
import RatingDistributionHistogram from "./RatingDistributionHistogram";
import TasteCompatibility from "./TasteCompatibility";
import Header from "./Header";
import { MoviesInCommonData } from "../types";
import Spinner from "./Spinner";

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

const UserComparison = () => {
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

  const StarRating = ({ rating }: { rating: number }) => {
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 !== 0;
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);

    return (
      <div className="flex items-center">
        {Array.from({ length: fullStars }, (_, i) => (
          <span key={`full-${i}`} className="text-letterboxd-accent text-lg">
            ★
          </span>
        ))}

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
      <main className="main-content">
        <div>
          <h1 className="text-3xl font-bold text-letterboxd-text-primary mb-2">
            User Comparison
          </h1>
          <h3 className="subheading">
            Compare rating statistics between two Letterboxd users
          </h3>
          <div className="card">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="relative">
                <div className="select-wrapper">
                  <select
                    value={selectedUser1}
                    onChange={(e) => handleUser1Change(e.target.value)}
                    disabled={loading}
                    className="input-field w-full"
                  >
                    <option value="">Select User 1</option>
                    {usernames.map((user) => (
                      <option key={user.username} value={user.username}>
                        {user.displayName || user.username}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <div className="select-wrapper">
                  <select
                    value={selectedUser2}
                    onChange={(e) => handleUser2Change(e.target.value)}
                    disabled={loading}
                    className="input-field w-full"
                  >
                    <option value="">Select User 2</option>
                    {usernames.map((user) => (
                      <option key={user.username} value={user.username}>
                        {user.displayName || user.username}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
          {error && (
            <div className="card border-red-500/30 bg-red-900/10">
              <h3 className="text-lg font-semibold text-red-400 mb-2">Error</h3>
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {moviesInCommonData && user1Data && user2Data && (
            <TasteCompatibility
              user1Data={user1Data}
              user2Data={user2Data}
              moviesInCommon={moviesInCommonData.moviesInCommon}
            />
          )}

          {(user1Data || user2Data) && (
            <div className="card">
              <h3 className="subheading">Rating Comparison</h3>

              <div className="overflow-x-auto">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Number Movies Rated</th>
                      <th>Distribution</th>
                      <th>Average Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {user1Data && (
                      <tr>
                        <td>{user1Data.displayName || user1Data.username}</td>
                        <td>{getTotalRatings(user1Data).toLocaleString()}</td>
                        <td className="py-3 px-4">
                          <RatingDistributionHistogram
                            distribution={user1Data.ratings}
                          />
                        </td>
                        <td>
                          {calculateAverageRating(user1Data).toFixed(2)} / 5.0
                        </td>
                      </tr>
                    )}
                    {user2Data && (
                      <tr>
                        <td>{user2Data.displayName || user2Data.username}</td>
                        <td>{getTotalRatings(user2Data).toLocaleString()}</td>
                        <td>
                          <RatingDistributionHistogram
                            distribution={user2Data.ratings}
                          />
                        </td>
                        <td>
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
          {moviesInCommonData && (
            <div className="card">
              <h3 className="subheading">Movies in Common</h3>

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
                <div className="overflow-x-auto max-h-50vh">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th className="sticky top-0 text-left py-3 px-4 text-letterboxd-text-secondary font-medium z-1 bg-letterboxd-bg-secondary">
                          Movie Title
                        </th>
                        <th className="sticky top-0 text-left py-3 px-4 text-letterboxd-text-secondary font-medium z-1 bg-letterboxd-bg-secondary">
                          {user1Data?.displayName || moviesInCommonData.user1}
                        </th>
                        <th className="sticky top-0 text-left py-3 px-4 text-letterboxd-text-secondary font-medium z-1 bg-letterboxd-bg-secondary">
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
                            <tr key={`${movie.title}-${index}`}>
                              <td className="py-3 px-4 text-letterboxd-text-primary font-medium">
                                <a
                                  href={`https://letterboxd.com/film/${movie.film_slug}`}
                                  target="_blank"
                                >
                                  {movie.title}
                                </a>
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
        </div>
      </main>
    </div>
  );
};

export default UserComparison;
