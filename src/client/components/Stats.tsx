import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import RatingDistributionHistogram from "./RatingDistributionHistogram";
import UserFilmsCount from "./UserFilmsCount";
import { useRatingsDistribution } from "../hooks/useRatingsDistribution";
import { useTopFilmsByYear } from "../hooks/useTopFilmsByYear";
import Spinner from "./Spinner";
import MovieBarChart from "./MovieBarChart";
import { cn } from "../lib/utils";

const FIRST_YEAR = 1910;

// Out-of-range values fall back to all-years so the <select> never holds a
// value with no matching <option>, and the server never sees a year it 400s on.
const parseYear = (raw: string | null, currentYear: number): number | null => {
  if (!raw) return null;
  const year = Number(raw);
  return Number.isInteger(year) && year >= FIRST_YEAR && year <= currentYear
    ? year
    : null;
};

const Dashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<"rated" | "watched">("rated");

  const currentYear = new Date().getFullYear();
  const selectedYear = parseYear(searchParams.get("year"), currentYear);

  const { data: allRatings, loading: ratingsLoading } = useRatingsDistribution();
  const { topRated, topWatched, loading, error } =
    useTopFilmsByYear(selectedYear);

  const years: number[] = [];
  for (let y = currentYear; y >= FIRST_YEAR; y--) years.push(y);

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
          onChange={(e) => {
            const { value } = e.target;
            setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              if (value) next.set("year", value);
              else next.delete("year");
              return next;
            });
          }}
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
        <p role="alert" className="body-text -prose text-letterboxd-error">
          {error}
        </p>
      ) : isInitialLoad ? (
        <Spinner />
      ) : (
        <>
          <div
            role="tablist"
            aria-label="Top films category"
            className="md:hidden flex mb-4 border-b border-letterboxd-border"
          >
            <button
              role="tab"
              id="tab-rated"
              aria-selected={activeTab === "rated"}
              aria-controls="panel-rated"
              onClick={() => setActiveTab("rated")}
              className={cn(
                "flex-1 -mb-px border-b-2 py-2 text-center font-medium transition-colors",
                activeTab === "rated"
                  ? "border-letterboxd-accent text-letterboxd-text-primary"
                  : "border-transparent text-letterboxd-text-secondary",
              )}
            >
              Highest rated
            </button>
            <button
              role="tab"
              id="tab-watched"
              aria-selected={activeTab === "watched"}
              aria-controls="panel-watched"
              onClick={() => setActiveTab("watched")}
              className={cn(
                "flex-1 -mb-px border-b-2 py-2 text-center font-medium transition-colors",
                activeTab === "watched"
                  ? "border-letterboxd-accent text-letterboxd-text-primary"
                  : "border-transparent text-letterboxd-text-secondary",
              )}
            >
              Most watched
            </button>
          </div>

          <div
            aria-busy={loading}
            className={cn(
              "flex flex-row justify-between max-md:justify-center max-md:flex-col m-auto w-full transition-opacity",
              loading && "opacity-50",
            )}
          >
            <div
              id="panel-rated"
              role="tabpanel"
              aria-labelledby="tab-rated"
              className={cn(
                "flex-1 min-w-0 md:mr-2",
                activeTab !== "rated" && "max-md:hidden",
              )}
            >
              <h3 className="subheading max-md:text-base">{ratedHeading}</h3>
              <MovieBarChart
                movies={topRated}
                showRating={true}
                emptyMessage={ratedEmpty}
              />
            </div>

            <div
              id="panel-watched"
              role="tabpanel"
              aria-labelledby="tab-watched"
              className={cn(
                "flex-1 min-w-0 md:ml-2",
                activeTab !== "watched" && "max-md:hidden",
              )}
            >
              <h3 className="subheading max-md:text-base">{watchedHeading}</h3>
              <MovieBarChart
                movies={topWatched}
                showCount={true}
                emptyMessage={watchedEmpty}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Dashboard;
