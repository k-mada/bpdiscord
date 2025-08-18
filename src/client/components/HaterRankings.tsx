import React, { useState, useEffect } from "react";
import { TrophyIcon } from "@heroicons/react/24/solid";
import apiService from "../services/api";
import { ALL_RATINGS } from "../constants";

interface HaterRanking {
  username: string;
  displayName?: string;
  averageRating: number;
  totalRatings: number;
  ratingDistribution?: Array<{ rating: number; count: number }>;
}

interface HaterRankingsProps {
  onBackToProfile?: () => void;
  isPublic?: boolean;
}

const HaterRankings: React.FC<HaterRankingsProps> = ({
  onBackToProfile,
  isPublic = false,
}) => {
  const [rankings, setRankings] = useState<HaterRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchHaterRankings();
  }, []);

  const fetchHaterRankings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getHaterRankings();

      if (response.error) {
        setError(response.error);
      } else if (response.data) {
        setRankings(response.data);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to fetch hater rankings"
      );
    } finally {
      setLoading(false);
    }
  };

  const formatRating = (rating: number): string => {
    return rating.toFixed(2);
  };

  const RatingDistributionHistogram: React.FC<{
    distribution: Array<{ rating: number; count: number }>;
  }> = ({ distribution }) => {
    if (!distribution || distribution.length === 0) {
      return (
        <span className="text-letterboxd-text-secondary text-xs">No data</span>
      );
    }

    const maxCount = Math.max(...distribution.map((d) => d.count));
    const totalCount = distribution.reduce((sum, d) => sum + d.count, 0);

    // Create a map for easy access and ensure we have all ratings from 0.5 to 5
    const distributionMap = new Map(
      distribution.map((d) => [d.rating, d.count])
    );

    return (
      <div className="flex items-end space-x-1 h-16 w-32">
        {ALL_RATINGS.map((rating) => {
          const count = distributionMap.get(rating) || 0;
          const percentage = maxCount > 0 ? count / maxCount : 0;
          // Use a more pronounced height calculation - minimum 4px for any data, max 60px
          const heightPx =
            count > 0 ? Math.max(4, Math.round(percentage * 60)) : 2;
          
          // Check if this bar has the maximum count (tallest bar)
          const isTallestBar = count > 0 && count === maxCount;

          return (
            <div
              key={rating}
              className="relative group"
              style={{ width: "10px" }}
            >
              <div
                className={`rounded-sm transition-all ${
                  count === 0 
                    ? "bg-green-800 opacity-30" 
                    : isTallestBar
                      ? "bg-letterboxd-accent hover:bg-letterboxd-accent-hover"
                      : "bg-green-800 hover:bg-green-900"
                }`}
                style={{
                  height: `${heightPx}px`,
                  minHeight: "2px",
                }}
                title={`${rating}★: ${count} movies (${
                  totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : 0
                }%)`}
              />
            </div>
          );
        })}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-letterboxd-accent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center">
        <div className="text-red-500 mb-4">{error}</div>
        <button onClick={fetchHaterRankings} className="btn-primary">
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold text-letterboxd-text-primary">
          Hater Rankings
        </h1>
        {onBackToProfile && (
          <button onClick={onBackToProfile} className="btn-secondary">
            Back to Profile
          </button>
        )}
      </div>

      <div className="bg-letterboxd-bg-secondary rounded-lg shadow-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-letterboxd-border">
          <h2 className="text-lg font-semibold text-letterboxd-text-primary">
            Users ranked by average movie rating (lowest first)
          </h2>
          <p className="text-sm text-letterboxd-text-secondary mt-1">
            The user with the lowest average rating is the biggest hater! 🏆
          </p>
        </div>

        {rankings.length === 0 ? (
          <div className="px-6 py-8 text-center text-letterboxd-text-secondary">
            No user ratings found. Users need to have their ratings scraped
            first.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-letterboxd-bg-primary border-b border-letterboxd-border">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-letterboxd-text-secondary uppercase tracking-wider">
                    Rank
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-letterboxd-text-secondary uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-letterboxd-text-secondary uppercase tracking-wider">
                    Total Movies Rated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-letterboxd-text-secondary uppercase tracking-wider">
                    Average Rating
                  </th>

                  <th className="px-6 py-3 text-left text-xs font-medium text-letterboxd-text-secondary uppercase tracking-wider">
                    Rating Distribution
                  </th>
                </tr>
              </thead>
              <tbody className="bg-letterboxd-bg-secondary divide-y divide-letterboxd-border">
                {rankings.map((ranking, index) => (
                  <tr
                    key={ranking.username}
                    className={`hover:bg-letterboxd-bg-primary transition-colors duration-200 ${
                      index === 0 ? "bg-yellow-50 dark:bg-yellow-900/20" : ""
                    }`}
                  >
                    <td className="px-6 py-1 whitespace-nowrap text-sm font-medium text-letterboxd-text-primary">
                      #{index + 1}
                    </td>
                    <td className="px-6 py-1 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        {index === 0 && (
                          <TrophyIcon className="h-5 w-5 text-yellow-500" />
                        )}
                        <span
                          className={`font-medium ${
                            index === 0
                              ? "text-2xl text-yellow-600 dark:text-yellow-400"
                              : "text-letterboxd-text-primary"
                          }`}
                        >
                          {ranking.displayName || ranking.username}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-1 whitespace-nowrap text-sm text-letterboxd-text-secondary">
                      {ranking.totalRatings}
                    </td>
                    <td className="px-6 py-1 whitespace-nowrap text-sm text-letterboxd-text-primary">
                      {formatRating(ranking.averageRating)} / 5.0
                    </td>

                    <td className="px-6 py-1 whitespace-nowrap">
                      <RatingDistributionHistogram
                        distribution={ranking.ratingDistribution || []}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {rankings.length > 0 && (
        <div className="text-center text-sm text-letterboxd-text-secondary">
          <p>
            Showing {rankings.length} user{rankings.length !== 1 ? "s" : ""}{" "}
            with ratings data
          </p>
        </div>
      )}
    </div>
  );
};

export default HaterRankings;
