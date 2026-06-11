// Compatibility metrics for two users' film ratings.
//
// Why Pearson over raw cosine: cosine similarity on positive-valued rating
// vectors with similar means (most users rate 3-4★) is mathematically pinned
// near 1 regardless of how their patterns actually differ. Pearson is cosine
// on mean-centered vectors, which answers the real question: "do you deviate
// from your own average in the same direction?"
//
// Why no imputation: filling missing ratings with each user's average puts
// those pairs exactly on the means, contributing zero to both covariance and
// variance — but the inflated sample size still biases the result toward the
// both-rated subset's pattern. Both-rated set only.

export interface RatedFilm {
  user1_rating: number;
  user2_rating: number;
}

export interface CompatibilityResult {
  /**
   * Pearson correlation coefficient on the user1/user2 ratings. Range [-1, +1].
   * `null` when either user's ratings have zero variance in the shared sample
   * (i.e. they gave the same rating to every film they both rated) — Pearson
   * is mathematically undefined in that case.
   */
  pearson: number | null;
  /**
   * Mean absolute difference in stars across the both-rated set. `null` only
   * when the sample is empty.
   */
  mad: number | null;
  /** Number of films both users rated (positive ratings only). */
  sampleSize: number;
}

/**
 * Below this many shared rated films, Pearson is too jumpy to be meaningful —
 * a single film can flip the sign. Callers should surface this to the user.
 */
export const MIN_RELIABLE_SAMPLE = 10;

export function computeCompatibility(films: RatedFilm[]): CompatibilityResult {
  // Reject non-finite ratings up front — NaN/Infinity would silently
  // poison every downstream calculation. Anything outside (0, ∞) is
  // also treated as "unrated" via the > 0 guard below, but defending
  // explicitly here is cheaper than chasing a mysterious NaN later.
  const bothRated = films.filter(
    (f) =>
      Number.isFinite(f.user1_rating) &&
      Number.isFinite(f.user2_rating) &&
      f.user1_rating > 0 &&
      f.user2_rating > 0,
  );
  const n = bothRated.length;

  if (n === 0) {
    return { pearson: null, mad: null, sampleSize: 0 };
  }

  const mean1 = bothRated.reduce((s, f) => s + f.user1_rating, 0) / n;
  const mean2 = bothRated.reduce((s, f) => s + f.user2_rating, 0) / n;

  let numerator = 0;
  let sumSqDev1 = 0;
  let sumSqDev2 = 0;
  let sumAbsDiff = 0;

  for (const f of bothRated) {
    const d1 = f.user1_rating - mean1;
    const d2 = f.user2_rating - mean2;
    numerator += d1 * d2;
    sumSqDev1 += d1 * d1;
    sumSqDev2 += d2 * d2;
    sumAbsDiff += Math.abs(f.user1_rating - f.user2_rating);
  }

  // sqrt(a * b) instead of sqrt(a) * sqrt(b) — one sqrt is fewer ops.
  // FP overflow can't happen for star ratings (variances stay under ~1e5).
  const denominator = Math.sqrt(sumSqDev1 * sumSqDev2);
  const pearson = denominator === 0 ? null : numerator / denominator;
  const mad = sumAbsDiff / n;

  return { pearson, mad, sampleSize: n };
}

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
 * "shared darling." Without this gate, a pair whose all-shared-films
 * sit at 2.5/2.5 would surface that as a "darling" — which reads
 * absurd. 3.5★ matches Letterboxd's "I liked it" threshold (above the
 * neutral midpoint).
 */
export const DARLING_MIN_RATING = 3.5;

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

/**
 * The film both users love most, tightest agreement preferred. Picks the
 * film maximizing `(avg_rating) - (rating_gap)` over the both-rated set
 * where both ratings are ≥ DARLING_MIN_RATING. Returns null if no film
 * qualifies (the pair has no shared "love").
 *
 * The score balances "rated high" against "rated similarly" — a 5/5 wins
 * over a 5/3.5 (same average, smaller gap).
 *
 * Tiebreak is the first-occurrence order in the input array (deterministic
 * given a stable input from the API).
 */
export function findSharedDarling<T extends RatedFilm>(films: T[]): T | null {
  const candidates = films.filter(
    (f) =>
      isValidRatingPair(f) &&
      f.user1_rating >= DARLING_MIN_RATING &&
      f.user2_rating >= DARLING_MIN_RATING,
  );
  if (candidates.length === 0) return null;

  const score = (f: RatedFilm): number =>
    (f.user1_rating + f.user2_rating) / 2 -
    Math.abs(f.user1_rating - f.user2_rating);

  return candidates.reduce((best, current) =>
    score(current) > score(best) ? current : best,
  );
}

/**
 * The film both users disagree on most, restricted to gaps ≥ FIGHT_MIN_GAP
 * (below that it's just rounding, not a fight). Returns null if no film
 * qualifies.
 *
 * Tiebreak is the first-occurrence order in the input array.
 */
export function findBiggestFight<T extends RatedFilm>(films: T[]): T | null {
  const candidates = films.filter(
    (f) =>
      isValidRatingPair(f) &&
      Math.abs(f.user1_rating - f.user2_rating) >= FIGHT_MIN_GAP,
  );
  if (candidates.length === 0) return null;

  return candidates.reduce((best, current) =>
    Math.abs(current.user1_rating - current.user2_rating) >
    Math.abs(best.user1_rating - best.user2_rating)
      ? current
      : best,
  );
}
