import {
  computeCompatibility,
  getPearsonLabel,
  formatSignedPercent,
  MIN_RELIABLE_SAMPLE,
  type RatedFilm,
} from "../lib/ratingsCompatibility";

const pair = (
  ratings1: number[],
  ratings2: number[],
): RatedFilm[] =>
  ratings1.map((r1, i) => ({ user1_rating: r1, user2_rating: ratings2[i] }));

describe("computeCompatibility", () => {
  describe("Pearson", () => {
    it("returns +1 for identical rating vectors", () => {
      const res = computeCompatibility(pair([5, 4, 3, 4, 5], [5, 4, 3, 4, 5]));
      expect(res.pearson).toBeCloseTo(1, 5);
    });

    it("returns -1 for perfectly reversed rating vectors", () => {
      const res = computeCompatibility(pair([5, 4, 3, 2, 1], [1, 2, 3, 4, 5]));
      expect(res.pearson).toBeCloseTo(-1, 5);
    });

    it("returns 0 for uncorrelated patterns", () => {
      // Constructed so deviations are orthogonal: mean1 = 3, mean2 = 3,
      // d1 = [+2, -2, +1, -1], d2 = [+1, +1, -1, -1], dot product = 0.
      const res = computeCompatibility(pair([5, 1, 4, 2], [4, 4, 2, 2]));
      expect(res.pearson).toBeCloseTo(0, 5);
    });

    it("returns null when one user has zero variance", () => {
      // user1 gave 4 to every shared film — Pearson undefined.
      const res = computeCompatibility(pair([4, 4, 4, 4], [5, 3, 4, 2]));
      expect(res.pearson).toBeNull();
    });

    it("returns null when both users have zero variance", () => {
      const res = computeCompatibility(pair([4, 4, 4], [3, 3, 3]));
      expect(res.pearson).toBeNull();
    });

    it("returns null for n=1 (variance is zero by definition)", () => {
      const res = computeCompatibility(pair([5], [4]));
      expect(res.pearson).toBeNull();
    });

    it("is robust to one user being a 'harsh critic' (mean-centering works)", () => {
      // User2 systematically rates 1.5★ lower but agrees on rankings.
      // Raw cosine would say "high similarity from positive bias"; Pearson
      // should isolate the pattern agreement and give +1.
      const res = computeCompatibility(
        pair([5, 4, 3, 4, 5], [3.5, 2.5, 1.5, 2.5, 3.5]),
      );
      expect(res.pearson).toBeCloseTo(1, 5);
    });
  });

  describe("MAD", () => {
    it("is 0 for identical vectors", () => {
      const res = computeCompatibility(pair([5, 4, 3], [5, 4, 3]));
      expect(res.mad).toBe(0);
    });

    it("is the mean of absolute differences", () => {
      // |5-1|=4, |4-2|=2, |3-3|=0, |2-4|=2, |1-5|=4 → sum=12, mean=2.4
      const res = computeCompatibility(pair([5, 4, 3, 2, 1], [1, 2, 3, 4, 5]));
      expect(res.mad).toBeCloseTo(2.4, 5);
    });

    it("is still defined when Pearson is null (zero variance)", () => {
      const res = computeCompatibility(pair([4, 4, 4], [3, 5, 4]));
      // |4-3|=1, |4-5|=1, |4-4|=0 → mean = 2/3
      expect(res.mad).toBeCloseTo(2 / 3, 5);
      expect(res.pearson).toBeNull();
    });
  });

  describe("sample size and filtering", () => {
    it("ignores films where either user's rating is 0 (unrated)", () => {
      const films: RatedFilm[] = [
        { user1_rating: 5, user2_rating: 4 },
        { user1_rating: 0, user2_rating: 3 }, // user1 unrated
        { user1_rating: 3, user2_rating: 0 }, // user2 unrated
        { user1_rating: 4, user2_rating: 5 },
      ];
      const res = computeCompatibility(films);
      expect(res.sampleSize).toBe(2);
    });

    it("returns all-null for empty input", () => {
      expect(computeCompatibility([])).toEqual({
        pearson: null,
        mad: null,
        sampleSize: 0,
      });
    });

    it("returns all-null when no films are rated by both", () => {
      const films: RatedFilm[] = [
        { user1_rating: 5, user2_rating: 0 },
        { user1_rating: 0, user2_rating: 4 },
      ];
      const res = computeCompatibility(films);
      expect(res.sampleSize).toBe(0);
      expect(res.pearson).toBeNull();
      expect(res.mad).toBeNull();
    });
  });

  describe("MIN_RELIABLE_SAMPLE", () => {
    it("is exported as a number", () => {
      expect(typeof MIN_RELIABLE_SAMPLE).toBe("number");
      expect(MIN_RELIABLE_SAMPLE).toBeGreaterThan(0);
    });
  });
});

describe("getPearsonLabel", () => {
  it.each([
    [1.0, "Strongly aligned"],
    [0.7, "Strongly aligned"], // boundary
    [0.5, "Aligned"],
    [0.4, "Aligned"], // boundary
    [0.2, "Somewhat aligned"],
    [0.1, "Somewhat aligned"], // boundary
    [0, "Mixed"],
    [-0.1, "Mixed"], // boundary
    [-0.2, "Diverging"],
    [-0.4, "Diverging"], // boundary
    [-0.5, "Opposite"],
    [-1.0, "Opposite"],
  ])("labels %f as %s", (value, expected) => {
    expect(getPearsonLabel(value)).toBe(expected);
  });
});

describe("formatSignedPercent", () => {
  it("prefixes positive values with +", () => {
    expect(formatSignedPercent(0.47)).toBe("+47%");
  });

  it("keeps the native minus sign on negative values", () => {
    expect(formatSignedPercent(-0.12)).toBe("-12%");
  });

  it("rounds tiny values to plain '0%' (no fake precision)", () => {
    expect(formatSignedPercent(0)).toBe("0%");
    expect(formatSignedPercent(0.004)).toBe("0%");
    expect(formatSignedPercent(-0.004)).toBe("0%");
  });

  it("rounds half-away-from-zero (JS default)", () => {
    expect(formatSignedPercent(0.005)).toBe("+1%");
    expect(formatSignedPercent(0.999)).toBe("+100%");
  });
});
