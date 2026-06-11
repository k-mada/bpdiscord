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

/**
 * Coarse human-readable label for a Pearson value. Thresholds are chosen for
 * UX legibility, not statistical rigor — calibrated to what a typical
 * Letterboxd user pair actually produces (most fall between 0.2 and 0.6),
 * so "Aligned" reads as the common case and "Strongly aligned" stays rare.
 */
export function getPearsonLabel(pearson: number): string {
  if (pearson >= 0.7) return "Strongly aligned";
  if (pearson >= 0.4) return "Aligned";
  if (pearson >= 0.1) return "Somewhat aligned";
  if (pearson >= -0.1) return "Mixed";
  if (pearson >= -0.4) return "Diverging";
  return "Opposite";
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
