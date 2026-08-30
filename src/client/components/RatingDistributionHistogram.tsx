import { ALL_RATINGS } from "../constants";

interface RatingDistributionHistogramProps {
  distribution: Array<{ rating: number; count: number }>;
  size?: string;
  className?: string;
}

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

          return (
            <div key={rating} className="histogram-bar">
              <div
                className={`rounded-xs ${
                  count === 0
                    ? "bg-green-800 opacity-30"
                    : isTallestBar
                      ? "bg-letterboxd-accent"
                      : "bg-green-800"
                }`}
                style={{
                  height: `${heightPx}px`,
                  minHeight: "2px",
                }}
              />
            </div>
          );
        })}
        {size === "md" && (
          <span className="rating-green rating-green-tiny rating-5">
            <span className="rating-star">★★★★★</span>
          </span>
        )}
      </div>

      <details className="mt-2 text-left">
        <summary className="text-xs text-letterboxd-text-muted cursor-pointer hover:text-letterboxd-text-primary">
          Rating counts
        </summary>
        <table className="mt-2 text-xs text-letterboxd-text-secondary">
          <caption className="sr-only">
            Rating distribution, {totalCount.toLocaleString()} ratings
          </caption>
          <thead>
            <tr>
              <th scope="col" className="pr-4 text-left font-medium">
                Rating
              </th>
              <th scope="col" className="pr-4 text-right font-medium">
                Ratings
              </th>
              <th scope="col" className="text-right font-medium">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ rating, count }) => (
              <tr key={rating}>
                <th scope="row" className="pr-4 text-left font-normal">
                  {rating} {rating === 1 ? "star" : "stars"}
                </th>
                <td className="pr-4 text-right tabular-nums">
                  {count.toLocaleString()}
                </td>
                <td className="text-right tabular-nums">
                  {formatShare(count, totalCount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
};

export default RatingDistributionHistogram;
