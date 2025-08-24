import React from "react";
import { ALL_RATINGS } from "../constants";
import Tooltip from "./Tooltip";

interface RatingDistributionHistogramProps {
  distribution: Array<{ rating: number; count: number }>;
  className?: string;
}

const RatingDistributionHistogram = ({ 
  distribution, 
  className = "" 
}: RatingDistributionHistogramProps) => {
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
    <div className={`flex items-end space-x-1 h-16 w-32 ${className}`}>
      {ALL_RATINGS.map((rating) => {
        const count = distributionMap.get(rating) || 0;
        const percentage = maxCount > 0 ? count / maxCount : 0;
        // Use a more pronounced height calculation - minimum 4px for any data, max 60px
        const heightPx =
          count > 0 ? Math.max(4, Math.round(percentage * 60)) : 2;
        
        // Check if this bar has the maximum count (tallest bar)
        const isTallestBar = count > 0 && count === maxCount;

        const formatStars = (rating: number): string => {
          const fullStars = Math.floor(rating);
          const hasHalf = rating % 1 !== 0;
          return "★".repeat(fullStars) + (hasHalf ? "½" : "");
        };

        const tooltipContent = count === 0 
          ? `${formatStars(rating)} ratings (0%)`
          : `${count.toLocaleString()} ${formatStars(rating)} ratings (${
              totalCount > 0 ? ((count / totalCount) * 100).toFixed(1) : 0
            }%)`;

        return (
          <Tooltip
            key={rating}
            content={tooltipContent}
          >
            <div
              className="relative"
              style={{ width: "10px" }}
            >
              <div
                className={`rounded-sm transition-all cursor-pointer ${
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
    </div>
  );
};

export default RatingDistributionHistogram;