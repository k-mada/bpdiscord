import React from "react";

interface Rating {
  rating: number;
  count: number;
}

interface UserData {
  username: string;
  displayName?: string;
  ratings: Rating[];
}

interface MovieInCommon {
  title: string;
  user1_rating: number;
  user2_rating: number;
}

interface TasteCompatibilityProps {
  user1Data: UserData | null;
  user2Data: UserData | null;
  moviesInCommon: MovieInCommon[];
}

interface CompatibilityResult {
  pearson: number | null;
  mad: number | null;
  sampleSize: number;
}

// Below this many shared rated films, Pearson is too jumpy to be meaningful —
// a single film can flip the sign. UI warns the user when we're under this.
const MIN_RELIABLE_SAMPLE = 10;

function computeCompatibility(movies: MovieInCommon[]): CompatibilityResult {
  const bothRated = movies.filter(
    (m) => m.user1_rating > 0 && m.user2_rating > 0,
  );
  const n = bothRated.length;

  if (n === 0) {
    return { pearson: null, mad: null, sampleSize: 0 };
  }

  const mean1 = bothRated.reduce((s, m) => s + m.user1_rating, 0) / n;
  const mean2 = bothRated.reduce((s, m) => s + m.user2_rating, 0) / n;

  let numerator = 0;
  let sumSqDev1 = 0;
  let sumSqDev2 = 0;
  let sumAbsDiff = 0;

  for (const m of bothRated) {
    const d1 = m.user1_rating - mean1;
    const d2 = m.user2_rating - mean2;
    numerator += d1 * d2;
    sumSqDev1 += d1 * d1;
    sumSqDev2 += d2 * d2;
    sumAbsDiff += Math.abs(m.user1_rating - m.user2_rating);
  }

  // Zero variance on either side: user gave the same rating to every shared
  // film in this sample. Pearson is undefined; MAD is still meaningful.
  const denominator = Math.sqrt(sumSqDev1) * Math.sqrt(sumSqDev2);
  const pearson = denominator === 0 ? null : numerator / denominator;
  const mad = sumAbsDiff / n;

  return { pearson, mad, sampleSize: n };
}

function getPearsonLabel(pearson: number): string {
  if (pearson >= 0.7) return "Strongly aligned";
  if (pearson >= 0.4) return "Aligned";
  if (pearson >= 0.1) return "Somewhat aligned";
  if (pearson >= -0.1) return "Mixed";
  if (pearson >= -0.4) return "Diverging";
  return "Opposite";
}

function formatSignedPercent(value: number): string {
  const pct = Math.round(value * 100);
  if (pct === 0) return "0%";
  return pct > 0 ? `+${pct}%` : `${pct}%`;
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
  // negative. 100% Pearson → fills exactly half the bar (from the center
  // to one edge).
  const barLeftPct =
    pearson === null ? 50 : pearson >= 0 ? 50 : 50 + pearson * 50;
  const barWidthPct = pearson === null ? 0 : Math.abs(pearson) * 50;
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
          {/* Center-anchored correlation bar */}
          <div className="mb-2">
            <div className="flex items-center gap-3">
              <div className="relative flex-1 bg-letterboxd-bg-primary rounded-full h-3 overflow-hidden">
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
              {mad !== null && (
                <div>{mad.toFixed(2)}★ apart on average</div>
              )}
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
