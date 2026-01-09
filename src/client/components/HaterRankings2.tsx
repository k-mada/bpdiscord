import { useState, useEffect } from "react";
import { TrophyIcon } from "@heroicons/react/24/solid";
import apiService from "../services/api";

import Spinner from "./Spinner";
import { Modal, ModalHeader, ModalBody } from "./Modal";
import RatingDifferential from "./RatingDifferential";

interface HaterRanking {
  displayName: string;
  username: string;
  filmsRated: number;
  differential: number;
  adjustedDifferential: number;
}

interface HaterRankingsProps {
  onBackToProfile?: () => void;
  isPublic?: boolean;
}

const HaterRankings2 = ({
  onBackToProfile,
  isPublic = false,
}: HaterRankingsProps) => {
  const [rankings, setRankings] = useState<HaterRanking[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState<boolean>(false);

  useEffect(() => {
    fetchHaterRankings();
  }, []);

  const fetchHaterRankings = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiService.getHaterRankings2();

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

  const handleClose = () => {
    setIsOpen(false);
  };

  if (loading) {
    return <Spinner />;
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

  const tooltipContent = "Normalized to per 100 movies rated";

  const RankingsContent = () => (
    <div>
      <Modal isOpen={isOpen} onClose={handleClose}>
        <ModalHeader onClose={handleClose}>
          How ratings are calculated
        </ModalHeader>
        <ModalBody>
          <aside className="calculation-explanation">
            <p>
              Rating calculation: (sum(user.film_rating -
              letterboxd.film_rating) / total_films_rated) x 100
            </p>
            {/* TODO: PUT EXPLANATION IN TOOLTIP, GENERALIZE TOOLTIP */}
            <ol>
              <li>
                For each user's rated movie, get the difference between the
                user's rating of a movie and the average Letterboxd rating (i.e.
                if user rated a movie 3.5 and the average letterboxd score is 4,
                the differntial is -0.5).
              </li>
              <li>Sum all of the differences of each movie</li>
              <li>Divide the sum by the number of films the user rated</li>
              <li>Multiply that result by 100</li>
              <li>
                (sum(user.film_rating - letterboxd.film_rating) /
                total_films_rated) x 100
              </li>
            </ol>
          </aside>
        </ModalBody>
      </Modal>
      <h1 className="text-3xl font-bold text-letterboxd-text-primary mb-2">
        Hater Rankings
      </h1>
      <h3 className="subheading">
        Based on differential from average Letterboxd ratings per 100 movies{" "}
        <span
          className="text-xs ml-4 cursor-pointer"
          onClick={() => {
            setIsOpen(true);
          }}
        >
          How is this calculated?
        </span>
      </h3>
      <div>
        {rankings.length === 0 ? (
          <div className="px-6 py-8 text-center text-letterboxd-text-secondary">
            No user ratings found. Users need to have their ratings scraped
            first.
          </div>
        ) : (
          <div>
            <table className="w-full">
              <thead>
                <tr className="table-heading-row">
                  <th>Rank</th>
                  <th>User</th>
                  <th>Total films rated</th>
                  <th className="flex items-center">
                    Differential (per 100 rated movies)
                  </th>
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
                          className={`font-medium text-xl ${
                            index === 0
                              ? "text-yellow-600 dark:text-yellow-400"
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
                      {ranking.filmsRated}
                    </td>
                    <td className="px-6 py-1 whitespace-nowrap text-sm text-letterboxd-text-primary">
                      <RatingDifferential
                        differential={ranking.adjustedDifferential}
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
    return <RankingsContent />;
  }

  // Dashboard version (embedded within authenticated layout)
  return <RankingsContent />;
};

export default HaterRankings2;
