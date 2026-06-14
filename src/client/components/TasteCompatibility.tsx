import {
  computeCompatibility,
  getPearsonLabel,
  getPearsonZone,
  formatSignedPercent,
  pearsonToBarPosition,
  findSharedDarling,
  findBiggestFight,
  findSharedHater,
  MIN_RELIABLE_SAMPLE,
  type PearsonZone,
} from "../lib/ratingsCompatibility";
import type { MovieInCommon } from "../types";
import Tooltip from "./Tooltip";
import StarRating from "./StarRating";

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
  user1Name: string;
  user2Name: string;
}

const AnchorFilm = ({ film, label, user1Name, user2Name }: AnchorFilmProps) => {
  // Letterboxd CDN URL embeds the requested dimensions. Same trick MovieList
  // uses — request a smaller asset for less bandwidth.
  const posterUrl = film.poster?.replace("0-230-0-345", "0-150-0-225") ?? null;
  const href =
    film.letterboxd_url ?? `https://letterboxd.com/film/${film.film_slug}`;

  return (
    <div className="flex flex-col items-center">
      <div className="text-lg font-semibold text-letterboxd-text-primary mb-3 text-center">
        {label}
      </div>

      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block w-full"
      >
        {posterUrl ? (
          <img
            src={posterUrl}
            alt={film.title}
            className="w-full border rounded-md border-slate-500"
          />
        ) : (
          <div className="flex aspect-[2/3] w-full items-center justify-center bg-slate-700 border rounded-md border-slate-500 p-2">
            <div className="text-center text-xs text-letterboxd-text-primary">
              {film.title}
              {film.year !== null && (
                <div className="text-letterboxd-text-muted mt-1">
                  ({film.year})
                </div>
              )}
            </div>
          </div>
        )}
      </a>
      <div className="w-full mt-2 p-2 px-12 text-center border rounded-md  border-slate-500 bg-slate-800 text-sm space-y-0.5">
        <div>
          <span className="text-letterboxd-text-muted">{user1Name}:</span>{" "}
          <span className="text-letterboxd-text-primary font-semibold tabular-nums">
            <StarRating rating={film.user1_rating} />
          </span>
        </div>
        <div>
          <span className="text-letterboxd-text-muted">{user2Name}:</span>{" "}
          <span className="text-letterboxd-text-primary font-semibold tabular-nums">
            <StarRating rating={film.user2_rating} />
          </span>
        </div>
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
  const rawFight = findBiggestFight(moviesInCommon);
  // Defensive: under current thresholds darling/fight can't share a film
  // (max overlap gap is 1.5 < FIGHT_MIN_GAP), but kept in case thresholds shift.
  const fight =
    rawFight && darling && rawFight.film_slug === darling.film_slug
      ? null
      : rawFight;
  const hater = findSharedHater(moviesInCommon);
  const hasAnchors = darling !== null || fight !== null || hater !== null;

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
        <div className="mt-6 pt-6 border-t border-letterboxd-border">
          <div className="flex flex-wrap justify-center gap-6 sm:gap-10">
            {darling && (
              <AnchorFilm
                film={darling}
                label="Shared fave"
                user1Name={user1Data.displayName || user1Data.username}
                user2Name={user2Data.displayName || user2Data.username}
              />
            )}
            {fight && (
              <AnchorFilm
                film={fight}
                label="Biggest fight"
                user1Name={user1Data.displayName || user1Data.username}
                user2Name={user2Data.displayName || user2Data.username}
              />
            )}
            {hater && (
              <AnchorFilm
                film={hater}
                label="Haters in Arms"
                user1Name={user1Data.displayName || user1Data.username}
                user2Name={user2Data.displayName || user2Data.username}
              />
            )}
          </div>
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
