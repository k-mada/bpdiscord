import { TrophyIcon } from "@heroicons/react/24/solid";
import { useHaterRankings } from "../hooks/useHaterRankings";
import RatingDistributionHistogram from "./RatingDistributionHistogram";
import Header from "./Header";
import Spinner from "./Spinner";

interface HaterRankingsProps {
  onBackToProfile?: () => void;
  isPublic?: boolean;
}

const HaterRankings = ({
  onBackToProfile,
  isPublic = false,
}: HaterRankingsProps) => {
  const { rankings, loading, error, refetch } = useHaterRankings();

  const formatRating = (rating: number): string => {
    return rating.toFixed(2);
  };

  if (loading) {
    return <Spinner />;
  }

  if (error) {
    return (
      <div className="text-center">
        <div className="text-red-500 mb-4">{error}</div>
        <button onClick={refetch} className="btn-primary">
          Try Again
        </button>
      </div>
    );
  }

  const RankingsContent = () => (
    <div>
      <h1 className="text-3xl font-bold text-letterboxd-text-primary mb-2">
        Hater Rankings
      </h1>
      <h3 className="subheading">
        Users ranked by average movie rating (lowest first)
      </h3>
      <div>
        {rankings.length === 0 ? (
          <div className="px-6 py-8 text-center text-letterboxd-text-secondary">
            No user ratings found. Users need to have their ratings scraped
            first.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  {[
                    "Rank",
                    "User",
                    "Total Movies Rated",
                    "Average Rating",
                    "Rating Distribution",
                  ].map((header) => (
                    <th
                      key={header}
                      className="px-6 py-3 text-left text-xs font-medium text-letterboxd-text-secondary uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rankings.map((ranking, index) => (
                  <tr key={ranking.username}>
                    <td className="px-6 py-1 whitespace-nowrap text-lg text-letterboxd-text-primary font-bold">
                      {index + 1}
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
                          <a
                            href={`https://letterboxd.com/${ranking.username}`}
                            target="_blank"
                          >
                            {ranking.displayName || ranking.username}
                          </a>
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

  // Public version with header and full page layout
  if (isPublic) {
    return (
      <div className="min-h-screen bg-letterboxd-bg-primary">
        <Header />
        <main className="main-content">
          <RankingsContent />
        </main>
      </div>
    );
  }

  // Dashboard version (embedded within authenticated layout)
  return <RankingsContent />;
};

export default HaterRankings;
