import React from "react";
import {
  computeCompatibility,
  getPearsonLabel,
  getPearsonZone,
  formatSignedPercent,
  pearsonToBarPosition,
  findSharedDarling,
  findBiggestFight,
  MIN_RELIABLE_SAMPLE,
  type PearsonZone,
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

// Layman explanation. Deliberately avoids "correlation," "Pearson," etc.
// Framed around predictability so the three zones are clearly distinct:
// Aligned and Opposite are both predictable (just in opposite directions);
// Independent is the noise zone where neither rule applies.
const TOOLTIP_EXPLANATION =
  "higher means you tend to react the same way to the same films. lower means you tend to react in opposite directions — when one of you loves it, the other reliably hates it. the middle means there's no pattern: sometimes you agree, sometimes you don't, but you can't predict it from each other.";

const ZONE_MARKER_COLOR: Record<PearsonZone, string> = {
  aligned: "bg-green-400",
  opposite: "bg-red-400",
  independent: "bg-letterboxd-text-muted",
};

function formatRating(r: number): string {
  // Drop trailing zero on integers (3 not 3.0), keep half-star precision.
  return r % 1 === 0 ? r.toFixed(0) : r.toFixed(1);
}

interface AnchorFilmProps {
  film: MovieInCommon;
  label: string;
  emoji: string;
}

const AnchorFilm = ({ film, label, emoji }: AnchorFilmProps) => {
  const titleContent = (
    <>
      {film.title}
      {film.year !== undefined && (
        <span className="text-letterboxd-text-muted font-normal">
          {" "}
          ({film.year})
        </span>
      )}
    </>
  );

  return (
    <div className="flex items-baseline justify-between gap-3">
      <div className="text-sm min-w-0">
        <span className="text-letterboxd-text-muted">
          {emoji} {label}:
        </span>{" "}
        {film.letterboxd_url ? (
          <a
            href={film.letterboxd_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-letterboxd-text-primary hover:text-letterboxd-accent font-medium truncate"
          >
            {titleContent}
          </a>
        ) : (
          <span className="text-letterboxd-text-primary font-medium">
            {titleContent}
          </span>
        )}
      </div>
      <div className="text-sm text-letterboxd-text-primary font-medium whitespace-nowrap tabular-nums">
        {formatRating(film.user1_rating)}/{formatRating(film.user2_rating)}
      </div>
    </div>
  );
};

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

  const darling = findSharedDarling(moviesInCommon);
  // Edge case: the only "fight" candidate might also qualify as the darling
  // (e.g. 5/3.5 — both above 3.5, gap exactly 2). Suppress the fight in
  // that case; showing the same film twice with conflicting framing reads
  // weirdly.
  const rawFight = findBiggestFight(moviesInCommon);
  const fight =
    rawFight && darling && rawFight.film_slug === darling.film_slug
      ? null
      : rawFight;
  const hasAnchors = darling !== null || fight !== null;

  const markerPositionPct =
    pearson === null ? 50 : pearsonToBarPosition(pearson);
  const markerColorClass =
    pearson === null
      ? ZONE_MARKER_COLOR.independent
      : ZONE_MARKER_COLOR[getPearsonZone(pearson)];

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

      {/* Spectrum bar with tick marker.
        * role=img (not progressbar): this is a position-on-a-continuum
        * visualization, not progress toward a goal. aria-label carries
        * the full description for screen readers.
        */}
      <div
        className="relative h-2 rounded-full bg-gradient-to-r from-red-400/15 via-letterboxd-text-muted/20 to-green-400/15"
        role="img"
        aria-label={
          pearson === null
            ? "Taste compatibility: not enough rating variation to compute"
            : `Taste compatibility: ${formatSignedPercent(pearson)}, ${getPearsonLabel(pearson)}`
        }
      >
        {/* Tick marks at the zone boundaries (1/3 and 2/3) */}
        <div className="absolute top-0 bottom-0 left-1/3 w-px bg-letterboxd-text-muted/30" />
        <div className="absolute top-0 bottom-0 left-2/3 w-px bg-letterboxd-text-muted/30" />
        {/* Marker. translate-x-1/2 centers it on its left edge regardless
          * of its width — no magic px offset to keep in sync. */}
        {pearson !== null && (
          <div
            className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-5 rounded-sm transition-all duration-500 ${markerColorClass}`}
            style={{ left: `${markerPositionPct}%` }}
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

      {hasAnchors && (
        <div className="mt-4 pt-4 border-t border-letterboxd-border space-y-2">
          {darling && (
            <AnchorFilm film={darling} label="Shared darling" emoji="🌟" />
          )}
          {fight && (
            <AnchorFilm film={fight} label="Biggest fight" emoji="⚔️" />
          )}
        </div>
      )}

      {lowSample && (
        <div className="text-xs text-amber-400 mt-3 text-center">
          Small sample — interpret with caution.
        </div>
      )}
    </div>
  );
};

export default TasteCompatibility;
