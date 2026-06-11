import React from "react";
import {
  computeCompatibility,
  getPearsonLabel,
  formatSignedPercent,
  MIN_RELIABLE_SAMPLE,
} from "../lib/ratingsCompatibility";
import type { MovieInCommon } from "../types";

// Narrower than the global UserData — this component only needs identity
// fields for the header. Pass-through compatible with the global type.
interface UserHeader {
  username: string;
  displayName?: string;
}

interface TasteCompatibilityProps {
  user1Data: UserHeader | null;
  user2Data: UserHeader | null;
  moviesInCommon: MovieInCommon[];
}

const TasteCompatibility = ({
  user1Data,
  user2Data,
  moviesInCommon,
}: TasteCompatibilityProps) => {
  if (!user1Data || !user2Data || !moviesInCommon.length) {
    return null;
  }

  const { pearson, mad, sampleSize } = computeCompatibility(moviesInCommon);

  // Center-anchored bar: fills right for positive correlation, left for
  // negative. 100% Pearson → fills exactly half the bar (center to one
  // edge). Minimum 2% width when non-null so low correlations (~±0.05)
  // still render as visible rather than disappearing entirely.
  const rawWidthPct = pearson === null ? 0 : Math.abs(pearson) * 50;
  const barWidthPct = pearson === null ? 0 : Math.max(rawWidthPct, 2);
  const barLeftPct =
    pearson === null
      ? 50
      : pearson >= 0
        ? 50
        : 50 - barWidthPct;
  const isNegative = pearson !== null && pearson < 0;
  const lowSample = sampleSize > 0 && sampleSize < MIN_RELIABLE_SAMPLE;

  return (
    <div className="card">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1">
          <h4 className="text-xl font-semibold text-letterboxd-text-primary mb-2 flex items-center gap-2">
            🎯 Taste Compatibility
          </h4>
          <div className="text-sm text-letterboxd-text-secondary">
            {user1Data.displayName || user1Data.username} vs{" "}
            {user2Data.displayName || user2Data.username}
          </div>
        </div>

        <div className="flex-1 max-w-md">
          <div className="mb-2">
            <div className="flex items-center gap-3">
              <div
                className="relative flex-1 bg-letterboxd-bg-primary rounded-full h-3 overflow-hidden"
                role="progressbar"
                aria-label="Taste correlation"
                aria-valuemin={-100}
                aria-valuemax={100}
                aria-valuenow={pearson === null ? 0 : Math.round(pearson * 100)}
                aria-valuetext={
                  pearson === null
                    ? "Not enough rating variation"
                    : `${formatSignedPercent(pearson)} — ${getPearsonLabel(pearson)}`
                }
              >
                <div className="absolute left-1/2 top-0 bottom-0 w-px bg-letterboxd-text-muted/40" />
                {pearson !== null && (
                  <div
                    className={`absolute top-0 bottom-0 h-full transition-all duration-500 ${
                      isNegative
                        ? "bg-gradient-to-l from-letterboxd-accent to-red-400"
                        : "bg-gradient-to-r from-letterboxd-accent to-green-400"
                    }`}
                    style={{
                      left: `${barLeftPct}%`,
                      width: `${barWidthPct}%`,
                    }}
                  />
                )}
              </div>
              <span className="text-lg font-bold text-letterboxd-text-primary min-w-[55px] text-right">
                {pearson === null ? "—" : formatSignedPercent(pearson)}
              </span>
            </div>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
            <div className="text-sm font-medium text-letterboxd-accent">
              {pearson === null
                ? "Not enough rating variation"
                : `"${getPearsonLabel(pearson)}"`}
            </div>
            <div className="text-xs text-letterboxd-text-muted text-right">
              {mad !== null && <div>{mad.toFixed(2)}★ apart on average</div>}
              <div>{sampleSize} films in common</div>
            </div>
          </div>

          {lowSample && (
            <div className="text-xs text-amber-400 mt-2">
              Small sample — interpret with caution.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TasteCompatibility;
