import { ALL_RATINGS } from "../constants";
import Tooltip from "./Tooltip";

interface RatingDistributionHistogramProps {
  distribution: Array<{ rating: number; count: number }>;
  size?: string;
  className?: string;
}

const formatStars = (rating: number): string => {
  const fullStars = Math.floor(rating);
  const hasHalf = rating % 1 !== 0;
  return "★".repeat(fullStars) + (hasHalf ? "½" : "");
};

const formatShare = (count: number, totalCount: number): string =>
  `${totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : "0.0"}%`;

const RatingDistributionHistogram = ({
  distribution,
  size = "sm",
  className = "",
}: RatingDistributionHistogramProps) => {
  if (!distribution || distribution.length === 0) {
    return (
      <span className="text-letterboxd-text-secondary text-xs">No data</span>
    );
  }

  // Every derived number comes from the rows actually rendered. A bucket outside
  // ALL_RATINGS (UserRatings carries 0 for unrated) must not skew heights or shares.
  const counts = new Map(distribution.map((d) => [d.rating, d.count]));
  const rows = ALL_RATINGS.map((rating) => ({
    rating,
    count: counts.get(rating) ?? 0,
  }));
  const maxCount = Math.max(...rows.map((r) => r.count));
  const totalCount = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <div className={className}>
      {/* Bars are decorative: making them focusable would add ~10 tab stops per
       * table row. The sr-only table below is the text alternative. */}
      <div className={`histogram-${size}`} aria-hidden="true">
        {size === "md" && <span className="rating-star">★</span>}
        {rows.map(({ rating, count }) => {
          const percentage = maxCount > 0 ? count / maxCount : 0;
          const heightScale = size === "sm" ? 60 : 100;
          // Use a more pronounced height calculation - minimum 4px for any data, max 60px
          const heightPx =
            count > 0 ? Math.max(4, Math.round(percentage * heightScale)) : 2;

          // Check if this bar has the maximum count (tallest bar)
          const isTallestBar = count > 0 && count === maxCount;

          const tooltipContent =
            count === 0
              ? `${formatStars(rating)} ratings (0%)`
              : `${count.toLocaleString()} ${formatStars(
                  rating,
                )} ratings (${formatShare(count, totalCount)})`;

          return (
            <Tooltip key={rating} content={tooltipContent}>
              <div className="histogram-bar">
                <div
                  className={`rounded-xs transition-all cursor-help ${
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
                />
              </div>
            </Tooltip>
          );
        })}
        {size === "md" && (
          <span className="rating-green rating-green-tiny rating-5">
            <span className="rating-star">★★★★★</span>
          </span>
        )}
      </div>

      <table className="sr-only">
        <caption>
          Rating distribution, {totalCount.toLocaleString()} ratings
        </caption>
        <thead>
          <tr>
            <th scope="col">Rating</th>
            <th scope="col">Ratings</th>
            <th scope="col">Share</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ rating, count }) => (
            <tr key={rating}>
              <th scope="row">
                {rating} {rating === 1 ? "star" : "stars"}
              </th>
              <td>{count.toLocaleString()}</td>
              <td>{formatShare(count, totalCount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default RatingDistributionHistogram;
