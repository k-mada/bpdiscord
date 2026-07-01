import { useState, useEffect } from "react";
import RatingDistributionHistogram from "./RatingDistributionHistogram";
import TasteCompatibility from "./TasteCompatibility";
import { useComparison } from "../hooks/useComparison";
import { useMoviesInCommon } from "../hooks/useMoviesInCommon";
import StarRating from "./StarRating";
import { DataTable } from "./DataTable/DataTable";
import { moviesInCommonColumns } from "./DataTable/columns";
import { MovieInCommon } from "../types";

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
  const { usernames, getUserComplete } = useComparison();
  const [selectedUser1, setSelectedUser1] = useState<string>("");
  const [selectedUser2, setSelectedUser2] = useState<string>("");
  const [user1Data, setUser1Data] = useState<UserData | null>(null);
  const [user2Data, setUser2Data] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filterNonRated, setFilterNonRated] = useState(false);

  const {
    data: moviesInCommonData,
    loading: loadingMovies,
    error: moviesError,
  } = useMoviesInCommon(selectedUser1 || null, selectedUser2 || null);

  const displayError = error || moviesError;
  const isLoading = loading || loadingMovies;

  const loadUserRatings = async (username: string, isUser1: boolean) => {
    if (!username) return;

    try {
      setLoading(true);
      setError(null);
      const data = await getUserComplete(username);

      if (data) {
        const userData: UserData = {
          username: data.username,
          followers: data.followers,
          following: data.following,
          numberOfLists: data.numberOfLists,
          totalFilms: data.totalRatings,
          ratings: data.ratings,
          ...(data.displayName ? { displayName: data.displayName } : {}),
        };

        if (isUser1) {
          setUser1Data(userData);
        } else {
          setUser2Data(userData);
        }
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load user ratings",
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
  }, [loadUserRatings, selectedUser1, selectedUser2]);

  const getTotalRatings = (userData: UserData | null): number => {
    if (!userData) return 0;
    return userData.ratings.reduce((sum, r) => sum + r.count, 0);
  };

  const calculateAverageRating = (userData: UserData | null): number => {
    if (!userData || userData.ratings.length === 0) return 0;

    const totalWeightedRating = userData.ratings.reduce(
      (sum, r) => sum + r.rating * r.count,
      0,
    );
    const totalCount = getTotalRatings(userData);

    return totalCount > 0 ? totalWeightedRating / totalCount : 0;
  };

  return (
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
                disabled={isLoading}
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
                disabled={isLoading}
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
      {displayError && (
        <div className="card border-red-500/30 bg-red-900/10">
          <h3 className="text-lg font-semibold text-red-400 mb-2">Error</h3>
          <p className="text-red-300">{displayError}</p>
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
              Hover over distribution bars to see detailed rating information
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
              <label htmlFor="chkFilterNonRated">Hide non-rated movies</label>
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
                  (Only displaying movies that have been rated by both users)
                </span>{" "}
              </p>
            )}
          </div>

          {moviesInCommonData.count > 0 && (
            <div className="overflow-x-auto max-h-50vh">
              <DataTable
                data={moviesInCommonData.moviesInCommon}
                columns={moviesInCommonColumns}
                enableSort={false}
                headerContext={{
                  user1: user1Data?.displayName || moviesInCommonData.user1,
                  user2: user2Data?.displayName || moviesInCommonData.user2,
                }}
                renderRow={(movie: MovieInCommon, index) => {
                  const hasNonRating =
                    movie.user1_rating === 0 || movie.user2_rating === 0;
                  const shouldShow = filterNonRated ? !hasNonRating : true;

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
                }}
              />
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
  );
};

export default UserComparison;
