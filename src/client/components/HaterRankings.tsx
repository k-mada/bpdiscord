import React, { useState, useEffect } from "react";
import { TrophyIcon } from "@heroicons/react/24/solid";
import apiService from "../services/api";
import RatingDistributionHistogram from "./RatingDistributionHistogram";
import Header from "./Header";

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

const HaterRankings = ({
  onBackToProfile,
  isPublic = false,
}: HaterRankingsProps) => {
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

      if (response.data) {
        setRankings(response.data);
      }
    } catch (err) {
      console.error("Error fetching hater rankings:", err);
      setError("Failed to load hater rankings");
    } finally {
      setLoading(false);
    }
  };

  const formatRating = (rating: number): string => {
    return rating.toFixed(2);
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner h-12 w-12"></div>
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

  const RankingsContent = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="page-title mb-0">
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
            No user ratings found. Users need to have their ratings scraped first.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-letterboxd-bg-primary border-b border-letterboxd-border">
                <tr>
                  {["Rank", "User", "Total Movies Rated", "Average Rating", "Rating Distribution"].map((header) => (
                    <th
                      key={header}
                      className="table-header"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-letterboxd-bg-secondary divide-y divide-letterboxd-border">
                {rankings.map((ranking, index) => (
                  <tr
                    key={ranking.username}
                    className={`table-row-hover ${
                      index === 0 ? "bg-yellow-50 dark:bg-yellow-900/20" : ""
                    }`}
                  >
                    <td className="table-cell-primary font-medium">
                      #{index + 1}
                    </td>
                    <td className="table-cell">
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
                    <td className="table-cell-secondary">
                      {ranking.totalRatings}
                    </td>
                    <td className="table-cell-primary">
                      {formatRating(ranking.averageRating)} / 5.0
                    </td>
                    <td className="table-cell">
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
            Showing {rankings.length} user{rankings.length !== 1 ? "s" : ""} with ratings data
          </p>
        </div>
      )}
    </div>
  );

  // Public version with header and full page layout
  if (isPublic) {
    return (
      <div className="min-h-screen bg-letterboxd-bg-primary">
        <Header />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <RankingsContent />
        </main>
      </div>
    );
  }

  // Dashboard version (embedded within authenticated layout)
  return <RankingsContent />;
};

export default HaterRankings;