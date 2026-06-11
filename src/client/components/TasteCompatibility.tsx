import React from "react";
import {
  computeCompatibility,
  getPearsonLabel,
  formatSignedPercent,
  pearsonToBarPosition,
  MIN_RELIABLE_SAMPLE,
} from "../lib/ratingsCompatibility";
import type { MovieInCommon } from "../types";
import Tooltip from "./Tooltip";

interface UserHeader {
  username: string;
  displayName?: string;
}

interface TasteCompatibilityProps {
  user1Data: UserHeader | null;
  user2Data: UserHeader | null;
  moviesInCommon: MovieInCommon[];
}

// Layman explanation. Deliberately avoids the words "correlation," "Pearson,"
// "deviation," etc. The Tooltip component lowercases its content, so written
// as a continuous sentence.
const TOOLTIP_EXPLANATION =
  "when one of you rates a film higher than your usual, the other tends to do the same — that's alignment. when you react in opposite directions — one loves it, the other hates it — that's opposition. independent means your reactions don't predict each other; you watch the same films but on different wavelengths.";

function getMarkerColorClass(pearson: number): string {
  if (pearson >= 1 / 3) return "bg-green-400";
  if (pearson <= -1 / 3) return "bg-red-400";
  return "bg-letterboxd-text-muted";
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
  const lowSample = sampleSize > 0 && sampleSize < MIN_RELIABLE_SAMPLE;

  const markerPositionPct =
    pearson === null ? 50 : pearsonToBarPosition(pearson);
  const markerColorClass = pearson === null ? "bg-letterboxd-text-muted" : getMarkerColorClass(pearson);

  return (
    <div className="card">
      {/* Header row */}
      <div className="mb-4">
        <h4 className="text-xl font-semibold text-letterboxd-text-primary flex items-center gap-2">
          🎯 Taste Compatibility
        </h4>
        <div className="text-sm text-letterboxd-text-secondary mt-1">
          {user1Data.displayName || user1Data.username} vs{" "}
          {user2Data.displayName || user2Data.username}
        </div>
      </div>

      {/* Zone labels */}
      <div className="grid grid-cols-3 text-xs text-letterboxd-text-muted mb-1.5">
        <div className="text-left">Opposite</div>
        <div className="text-center">Independent</div>
        <div className="text-right">Aligned</div>
      </div>

      {/* Spectrum bar with tick marker */}
      <div
        className="relative h-2 rounded-full bg-gradient-to-r from-red-400/15 via-letterboxd-text-muted/20 to-green-400/15"
        role="progressbar"
        aria-label="Taste correlation spectrum"
        aria-valuemin={-100}
        aria-valuemax={100}
        aria-valuenow={pearson === null ? 0 : Math.round(pearson * 100)}
        aria-valuetext={
          pearson === null
            ? "Not enough rating variation to compute"
            : `${formatSignedPercent(pearson)} — ${getPearsonLabel(pearson)}`
        }
      >
        {/* Tick marks at the zone boundaries (1/3 and 2/3) */}
        <div className="absolute top-0 bottom-0 left-1/3 w-px bg-letterboxd-text-muted/30" />
        <div className="absolute top-0 bottom-0 left-2/3 w-px bg-letterboxd-text-muted/30" />
        {/* Marker */}
        {pearson !== null && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 w-1.5 h-5 rounded-sm transition-all duration-500 ${markerColorClass}`}
            style={{ left: `calc(${markerPositionPct}% - 3px)` }}
          />
        )}
      </div>

      {/* Headline number + label */}
      <div className="mt-4 text-center">
        <div className="text-3xl font-bold text-letterboxd-text-primary leading-none">
          {pearson === null ? "—" : formatSignedPercent(pearson)}
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-1">
          <div className="text-sm font-medium text-letterboxd-accent">
            {pearson === null
              ? "Not enough rating variation"
              : getPearsonLabel(pearson)}
          </div>
          <Tooltip content={TOOLTIP_EXPLANATION}>
            <span
              className="text-letterboxd-text-muted hover:text-letterboxd-text-primary cursor-help text-sm"
              aria-label="What does this mean?"
              tabIndex={0}
            >
              ⓘ
            </span>
          </Tooltip>
        </div>
        <div className="text-xs text-letterboxd-text-muted mt-2">
          {sampleSize} films in common
          {mad !== null && ` · ${mad.toFixed(2)}★ apart on average`}
        </div>
      </div>

      {lowSample && (
        <div className="text-xs text-amber-400 mt-3 text-center">
          Small sample — interpret with caution.
        </div>
      )}
    </div>
  );
};

export default TasteCompatibility;
