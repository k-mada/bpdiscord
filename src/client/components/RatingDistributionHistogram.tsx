import { useEffect, useState } from "react";
import { ALL_RATINGS } from "../constants";

interface RatingDistributionHistogramProps {
  distribution: Array<{ rating: number; count: number }>;
  size?: string;
  className?: string;
}

const NEXT_KEYS = ["ArrowRight", "ArrowUp"];
const PREV_KEYS = ["ArrowLeft", "ArrowDown"];

const formatShare = (count: number, totalCount: number): string =>
  `${totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : "0.0"}%`;

const ratingLabel = (rating: number): string =>
  `${rating} ${rating === 1 ? "star" : "stars"}`;

// jsdom's selector engine does not implement :focus-visible and throws on it.
const isKeyboardFocus = (element: HTMLElement): boolean => {
  try {
    return element.matches(":focus-visible");
  } catch {
    return false;
  }
};

const RatingDistributionHistogram = ({
  distribution,
  size = "sm",
  className = "",
}: RatingDistributionHistogramProps) => {
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);

  // A hovering pointer user has no focus to receive Escape, and 1.4.13
  // requires dismissal without moving the pointer.
  useEffect(() => {
    if (hovered === null) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDismissed(true);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hovered]);

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

  const active = dismissed ? null : (hovered ?? focused);

  const handleMouseOver = (event: React.MouseEvent<HTMLDivElement>) => {
    const bar = (event.target as HTMLElement).closest("[data-bar-index]");
    const next = bar ? Number(bar.getAttribute("data-bar-index")) : null;
    if (next === hovered) return;
    setHovered(next);
    setDismissed(false);
  };

  const clearPointer = () => {
    setHovered(null);
    setDismissed(false);
  };

  const handleFocus = (event: React.FocusEvent<HTMLDivElement>) => {
    // Focus arriving from a click is not :focus-visible, so a click cannot pin
    // the panel open. Tab does, so keyboard users keep 1.4.13 persistence.
    if (isKeyboardFocus(event.currentTarget)) setFocused(0);
  };

  const handleBlur = () => {
    setFocused(null);
    setDismissed(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      setDismissed(true);
      return;
    }

    const last = rows.length - 1;
    let next: number;
    if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    else if (NEXT_KEYS.includes(event.key)) next = (focused ?? -1) + 1;
    else if (PREV_KEYS.includes(event.key)) next = (focused ?? last + 1) - 1;
    else return;

    event.preventDefault();
    setFocused(Math.min(last, Math.max(0, next)));
    setDismissed(false);
  };

  return (
    <div className={className}>
      <div
        className={`histogram-${size}`}
        role="group"
        aria-label={`Rating distribution chart, ${totalCount.toLocaleString()} ratings`}
        tabIndex={0}
        onMouseOver={handleMouseOver}
        onMouseLeave={clearPointer}
        onFocus={handleFocus}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
      >
        {size === "md" && (
          <span className="rating-star" aria-hidden="true">
            ★
          </span>
        )}
        {rows.map(({ rating, count }, index) => {
          const percentage = maxCount > 0 ? count / maxCount : 0;
          const heightScale = size === "sm" ? 60 : 100;
          // Use a more pronounced height calculation - minimum 4px for any data, max 60px
          const heightPx =
            count > 0 ? Math.max(4, Math.round(percentage * heightScale)) : 2;

          // Check if this bar has the maximum count (tallest bar)
          const isTallestBar = count > 0 && count === maxCount;

          return (
            <div
              key={rating}
              className="histogram-bar"
              data-bar-index={index}
              aria-hidden="true"
            >
              {active === index && (
                // The gap above the bar is padding INSIDE this wrapper, never a
                // margin: 1.4.13 needs one contiguous hover area to cross.
                <div
                  data-testid="histogram-tooltip"
                  className="absolute bottom-full left-1/2 z-50 -translate-x-1/2 pb-2"
                >
                  <div className="whitespace-nowrap rounded-sm border border-letterboxd-border-light bg-letterboxd-bg-tertiary px-2 py-1 text-xs text-letterboxd-text-primary shadow-letterboxd">
                    {ratingLabel(rating)}: {count.toLocaleString()} (
                    {formatShare(count, totalCount)})
                  </div>
                </div>
              )}
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
          <span
            className="rating-green rating-green-tiny rating-5"
            aria-hidden="true"
          >
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
              <th scope="row">{ratingLabel(rating)}</th>
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
