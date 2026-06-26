import { useState } from "react";
import RatingDistributionHistogram from "./RatingDistributionHistogram";
import UserFilmsCount from "./UserFilmsCount";
import { useRatingsDistribution } from "../hooks/useRatingsDistribution";
import { useTopFilmsByYear } from "../hooks/useTopFilmsByYear";
import Spinner from "./Spinner";
import MovieList from "./MovieList";
import { cn } from "../lib/utils";

const FIRST_YEAR = 1910;

const Dashboard = () => {
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  const { data: allRatings, loading: ratingsLoading } = useRatingsDistribution();
  const { topRated, topWatched, loading, error } =
    useTopFilmsByYear(selectedYear);

  const years: number[] = [];
  for (let y = new Date().getFullYear(); y >= FIRST_YEAR; y--) years.push(y);

  const ratedHeading =
    selectedYear === null
      ? "Our highest rated movies (20+ ratings)"
      : `Top rated movies of ${selectedYear} (5+ ratings)`;
  const watchedHeading =
    selectedYear === null
      ? "Our most watched movies"
      : `Most watched movies of ${selectedYear}`;
  const ratedEmpty =
    selectedYear === null
      ? "No rated films yet."
      : `No films released in ${selectedYear} have enough ratings yet.`;
  const watchedEmpty =
    selectedYear === null
      ? "No watched films yet."
      : `No films released in ${selectedYear} watched yet.`;

  // Keep the lists mounted (dimmed) while a new year loads to avoid a layout
  // jump; only show the full-page spinner before the first results arrive.
  const isInitialLoad =
    loading && topRated.length === 0 && topWatched.length === 0;

  return (
    <div>
      <div className="body-text -prose">
        <p>
          Welcome to the Big Picture Discord. This is a fun project meant to
          augment the Letterboxd experience specifically for the members of this
          Discord.
        </p>
      </div>
      <UserFilmsCount />
      <h3 className="subheading">How we rated all of our movies:</h3>
      <div className="flex mb-4 justify-center">
        {ratingsLoading ? (
          <Spinner />
        ) : (
          <RatingDistributionHistogram size="md" distribution={allRatings} />
        )}
      </div>

      <div className="flex items-center gap-2 mb-6 justify-center">
        <label htmlFor="top-films-year" className="body-text">
          Filter top films by year:
        </label>
        <select
          id="top-films-year"
          className="input-field"
          value={selectedYear ?? ""}
          onChange={(e) =>
            setSelectedYear(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      {error ? (
        <p className="body-text -prose text-red-400">{error}</p>
      ) : isInitialLoad ? (
        <Spinner />
      ) : (
        <div
          className={cn(
            "flex flex-row justify-between max-md:justify-center max-md:flex-col m-auto w-full transition-opacity",
            loading && "opacity-50",
          )}
        >
          <div className="flex-1 mr-2">
            <h3 className="subheading">{ratedHeading}</h3>
            <MovieList
              movies={topRated}
              showRating={true}
              size="sm"
              emptyMessage={ratedEmpty}
            />
          </div>

          <div className="flex-1 ml-2">
            <h3 className="subheading">{watchedHeading}</h3>
            <MovieList
              size="sm"
              movies={topWatched}
              showCount={true}
              emptyMessage={watchedEmpty}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
