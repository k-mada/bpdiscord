// Presentation helpers (Pearson zone/label/bar-position) and anchor-film
// finders. The Pearson/MAD math now lives in the taste_compatibility SQL fn.

export interface RatedFilm {
  user1_rating: number;
  user2_rating: number;
}

/**
 * Below this many shared rated films, Pearson is too jumpy to be meaningful —
 * a single film can flip the sign. Callers should surface this to the user.
 */
export const MIN_RELIABLE_SAMPLE = 10;

export type PearsonZone = "aligned" | "independent" | "opposite";

/**
 * Zone identifier for a Pearson value. Single source of truth for the
 * threshold logic — UI uses this to pick colors, to derive the display
 * label, and (eventually) anywhere else that needs to branch on zone.
 *
 * Thresholds at ±1/3 partition the Pearson range [-1, +1] into three
 * equal zones, so the zone boundary aligns exactly with the marker
 * crossing a third of the bar.
 */
export function getPearsonZone(pearson: number): PearsonZone {
  if (pearson >= 1 / 3) return "aligned";
  if (pearson <= -1 / 3) return "opposite";
  return "independent";
}

const ZONE_LABELS: Record<PearsonZone, string> = {
  aligned: "Aligned",
  independent: "Independent",
  opposite: "Opposite",
};

/**
 * Capitalized human-readable label matching the spectrum's zone labels.
 * The spectrum bar shows the continuous position; the label just confirms
 * which zone the marker is in. Granularity comes from the bar, not the
 * label.
 */
export function getPearsonLabel(pearson: number): string {
  return ZONE_LABELS[getPearsonZone(pearson)];
}

/**
 * Maps Pearson [-1, +1] to a position on the spectrum bar [0%, 100%].
 * 0% = far-left (Opposite), 50% = center (Independent), 100% = far-right
 * (Aligned).
 */
export function pearsonToBarPosition(pearson: number): number {
  return ((pearson + 1) / 2) * 100;
}

/**
 * Format a value in [-1, 1] as a signed percentage. Rounds half-toward-zero
 * so "+0.4%" and "-0.4%" both display as "0%" (no fake precision).
 */
export function formatSignedPercent(value: number): string {
  const pct = Math.round(value * 100);
  if (pct === 0) return "0%";
  return pct > 0 ? `+${pct}%` : `${pct}%`;
}

// ===========================
// Anchor films — concrete callouts that tell a story the numbers can't.
// Generic over T so callers can pass MovieInCommon (or any extension of
// RatedFilm) and get the full object back, not just the ratings.
// ===========================

/**
 * Minimum rating both users must give a film for it to qualify as a
 * "shared darling." 3.5★ matches Letterboxd's "I liked it" threshold.
 */
export const DARLING_MIN_RATING = 3.5;

/**
 * Maximum rating both users can give a film for it to qualify as a
 * "shared hater." Mirror of DARLING_MIN_RATING — 2.0★ sits below the
 * neutral midpoint (2.5★).
 */
export const HATER_MAX_RATING = 2.0;

/**
 * Minimum rating gap for a film to qualify as a "biggest fight." Below
 * this it's not really a disagreement; just rounding.
 */
export const FIGHT_MIN_GAP = 2;

function isValidRatingPair(f: RatedFilm): boolean {
  return (
    Number.isFinite(f.user1_rating) &&
    Number.isFinite(f.user2_rating) &&
    f.user1_rating > 0 &&
    f.user2_rating > 0
  );
}

// Lower = rated by fewer users = more "this pair's" pick. Used to break
// ties so popular films don't dominate via the API's alphabetical order.
function distinctiveness(f: RatedFilm & { total_ratings?: number }): number {
  return f.total_ratings ?? Infinity;
}

// Shared engine for all anchor finders: filter to candidates, pick the
// one with the highest score, break ties by distinctiveness.
function pickBestByScore<T extends RatedFilm>(
  films: T[],
  filter: (f: T) => boolean,
  score: (f: T) => number,
): T | null {
  const candidates = films.filter(filter);
  if (candidates.length === 0) return null;
  return candidates.reduce((best, current) => {
    const sBest = score(best);
    const sCurrent = score(current);
    if (sCurrent > sBest) return current;
    if (sCurrent < sBest) return best;
    return distinctiveness(current) < distinctiveness(best) ? current : best;
  });
}

/**
 * The film both users love most, tightest agreement preferred. Maximizes
 * `(avg) - gap` over films where both ratings ≥ DARLING_MIN_RATING. Ties
 * broken by lower total_ratings.
 */
export function findSharedDarling<T extends RatedFilm>(films: T[]): T | null {
  return pickBestByScore(
    films,
    (f) =>
      isValidRatingPair(f) &&
      f.user1_rating >= DARLING_MIN_RATING &&
      f.user2_rating >= DARLING_MIN_RATING,
    (f) =>
      (f.user1_rating + f.user2_rating) / 2 -
      Math.abs(f.user1_rating - f.user2_rating),
  );
}

/**
 * The film both users dislike most, tightest agreement preferred. Mirror
 * of findSharedDarling: maximizes `-(avg) - gap` over films where both
 * ratings ≤ HATER_MAX_RATING. Ties broken by lower total_ratings.
 */
export function findSharedHater<T extends RatedFilm>(films: T[]): T | null {
  return pickBestByScore(
    films,
    (f) =>
      isValidRatingPair(f) &&
      f.user1_rating <= HATER_MAX_RATING &&
      f.user2_rating <= HATER_MAX_RATING,
    (f) =>
      -((f.user1_rating + f.user2_rating) / 2) -
      Math.abs(f.user1_rating - f.user2_rating),
  );
}

/**
 * The film both users disagree on most, restricted to gaps ≥ FIGHT_MIN_GAP.
 * Ties broken by lower total_ratings.
 */
export function findBiggestFight<T extends RatedFilm>(films: T[]): T | null {
  return pickBestByScore(
    films,
    (f) =>
      isValidRatingPair(f) &&
      Math.abs(f.user1_rating - f.user2_rating) >= FIGHT_MIN_GAP,
    (f) => Math.abs(f.user1_rating - f.user2_rating),
  );
}
