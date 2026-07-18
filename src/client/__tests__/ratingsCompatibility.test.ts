import {
  getPearsonLabel,
  getPearsonZone,
  formatSignedPercent,
  pearsonToBarPosition,
  findSharedDarling,
  findBiggestFight,
  findSharedHater,
  DARLING_MIN_RATING,
  HATER_MAX_RATING,
  FIGHT_MIN_GAP,
  MIN_RELIABLE_SAMPLE,
  type RatedFilm,
} from "../lib/ratingsCompatibility";

describe("MIN_RELIABLE_SAMPLE", () => {
  it("is exported as a number", () => {
    expect(typeof MIN_RELIABLE_SAMPLE).toBe("number");
    expect(MIN_RELIABLE_SAMPLE).toBeGreaterThan(0);
  });
});

describe("getPearsonZone", () => {
  it.each([
    [1.0, "aligned"],
    [0.5, "aligned"],
    [1 / 3, "aligned"], // boundary
    [0.3, "independent"],
    [0, "independent"],
    [-0.3, "independent"],
    [-1 / 3, "opposite"], // boundary
    [-0.5, "opposite"],
    [-1.0, "opposite"],
  ])("zone for %f is %s", (value, expected) => {
    expect(getPearsonZone(value)).toBe(expected);
  });
});

describe("getPearsonLabel", () => {
  it.each([
    [0.5, "Aligned"],
    [0, "Independent"],
    [-0.5, "Opposite"],
  ])("labels %f as %s", (value, expected) => {
    expect(getPearsonLabel(value)).toBe(expected);
  });

  it("stays in sync with getPearsonZone (single source of truth)", () => {
    // If someone changes the zone thresholds in only one place, this test
    // catches the drift.
    const samples = [-1, -0.5, -1 / 3, -0.1, 0, 0.1, 1 / 3, 0.5, 1];
    for (const p of samples) {
      const zone = getPearsonZone(p);
      const label = getPearsonLabel(p);
      expect(label.toLowerCase()).toBe(zone);
    }
  });
});

describe("pearsonToBarPosition", () => {
  it.each([
    [-1, 0],
    [-0.5, 25],
    [0, 50],
    [0.5, 75],
    [1, 100],
  ])("maps %f to %f%%", (pearson, expectedPct) => {
    expect(pearsonToBarPosition(pearson)).toBeCloseTo(expectedPct, 5);
  });

  it("places zone-boundary Pearson values at the bar's thirds", () => {
    // 1/3 of Pearson range maps to 2/3 of the bar (= 66.67%) and -1/3 to 1/3.
    expect(pearsonToBarPosition(1 / 3)).toBeCloseTo(200 / 3, 5);
    expect(pearsonToBarPosition(-1 / 3)).toBeCloseTo(100 / 3, 5);
  });
});

interface NamedFilm extends RatedFilm {
  title: string;
}

const namedPair = (
  entries: Array<[string, number, number]>,
): NamedFilm[] =>
  entries.map(([title, r1, r2]) => ({
    title,
    user1_rating: r1,
    user2_rating: r2,
  }));

describe("findSharedDarling", () => {
  it("picks the film both users love most, tightest agreement preferred", () => {
    const films = namedPair([
      ["Movie A", 5, 5], // perfect joint love
      ["Movie B", 5, 3.5], // high avg, big gap
      ["Movie C", 4, 4], // moderate
    ]);
    expect(findSharedDarling(films)?.title).toBe("Movie A");
  });

  it("prefers smaller gap when averages are equal", () => {
    const films = namedPair([
      ["Movie A", 5, 4], // avg 4.5, gap 1
      ["Movie B", 4.5, 4.5], // avg 4.5, gap 0
    ]);
    expect(findSharedDarling(films)?.title).toBe("Movie B");
  });

  it("returns null when no film qualifies (no shared love)", () => {
    const films = namedPair([
      ["Movie A", 3, 3], // below threshold
      ["Movie B", 4, 2], // user2 below threshold
      ["Movie C", 2, 5], // user1 below threshold
    ]);
    expect(findSharedDarling(films)).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(findSharedDarling([])).toBeNull();
  });

  it("uses 3.5 as the qualifying threshold (matches Letterboxd 'liked it')", () => {
    const films = namedPair([
      ["Boundary low", 3, 4], // user1 below threshold
      ["Boundary at", 3.5, 3.5], // exactly at threshold, both qualify
    ]);
    expect(findSharedDarling(films)?.title).toBe("Boundary at");
    expect(DARLING_MIN_RATING).toBe(3.5);
  });

  it("ignores non-finite ratings", () => {
    const films: NamedFilm[] = [
      { title: "Bad", user1_rating: NaN, user2_rating: 5 },
      { title: "Good", user1_rating: 5, user2_rating: 5 },
    ];
    expect(findSharedDarling(films)?.title).toBe("Good");
  });

  it("preserves caller's full object shape (generic over T)", () => {
    interface FilmWithSlug extends RatedFilm {
      slug: string;
    }
    const films: FilmWithSlug[] = [
      { slug: "darling", user1_rating: 5, user2_rating: 5 },
    ];
    const result = findSharedDarling(films);
    expect(result?.slug).toBe("darling");
  });

  it("ties on score: prefers film with fewer total_ratings (more distinctive)", () => {
    interface ScoredFilm extends RatedFilm {
      title: string;
      total_ratings: number;
    }
    const films: ScoredFilm[] = [
      { title: "Crowd-pleaser", user1_rating: 5, user2_rating: 5, total_ratings: 1000 },
      { title: "Hidden gem",    user1_rating: 5, user2_rating: 5, total_ratings: 12 },
      { title: "Common fav",    user1_rating: 5, user2_rating: 5, total_ratings: 500 },
    ];
    expect(findSharedDarling(films)?.title).toBe("Hidden gem");
  });

  it("ties on score, no total_ratings: falls back to first-occurrence", () => {
    const films = namedPair([
      ["First", 5, 5],
      ["Second", 5, 5],
    ]);
    expect(findSharedDarling(films)?.title).toBe("First");
  });
});

describe("findBiggestFight", () => {
  it("picks the film with the largest rating gap", () => {
    const films = namedPair([
      ["Mild", 4, 3], // gap 1
      ["Real", 5, 2], // gap 3
      ["Polarized", 4.5, 1], // gap 3.5
    ]);
    expect(findBiggestFight(films)?.title).toBe("Polarized");
  });

  it("requires gap >= FIGHT_MIN_GAP — gaps below threshold don't count", () => {
    const films = namedPair([
      ["Close 1", 4, 3], // gap 1
      ["Close 2", 4.5, 3.5], // gap 1
      ["Close 3", 3, 3.5], // gap 0.5
    ]);
    expect(findBiggestFight(films)).toBeNull();
    expect(FIGHT_MIN_GAP).toBe(2);
  });

  it("matches at exactly the FIGHT_MIN_GAP boundary", () => {
    const films = namedPair([
      ["At threshold", 4, 2], // gap exactly 2
    ]);
    expect(findBiggestFight(films)?.title).toBe("At threshold");
  });

  it("returns null for empty input", () => {
    expect(findBiggestFight([])).toBeNull();
  });

  it("ignores films either user hasn't rated (rating 0)", () => {
    const films = namedPair([
      ["Unrated", 5, 0], // user2 hasn't rated
      ["Fight", 4, 2], // legitimate fight
    ]);
    expect(findBiggestFight(films)?.title).toBe("Fight");
  });

  it("ignores non-finite ratings", () => {
    const films: NamedFilm[] = [
      { title: "Bad", user1_rating: Infinity, user2_rating: 1 },
      { title: "Fight", user1_rating: 5, user2_rating: 2 },
    ];
    expect(findBiggestFight(films)?.title).toBe("Fight");
  });

  it("ties on gap: prefers film with fewer total_ratings (more distinctive)", () => {
    interface ScoredFilm extends RatedFilm {
      title: string;
      total_ratings: number;
    }
    const films: ScoredFilm[] = [
      { title: "Popular fight", user1_rating: 5, user2_rating: 2, total_ratings: 800 },
      { title: "Niche fight",   user1_rating: 5, user2_rating: 2, total_ratings: 20 },
    ];
    expect(findBiggestFight(films)?.title).toBe("Niche fight");
  });
});

describe("findSharedHater", () => {
  it("picks the film both users dislike most, tightest agreement preferred", () => {
    const films = namedPair([
      ["Mild dislike", 2, 2],   // avg 2, gap 0
      ["Worst",        0.5, 0.5], // avg 0.5, gap 0 — the real shared hate
      ["Disagree low", 2, 0.5], // avg 1.25, gap 1.5
    ]);
    expect(findSharedHater(films)?.title).toBe("Worst");
  });

  it("prefers smaller gap when averages are equal", () => {
    const films = namedPair([
      ["Wider", 2, 0.5],   // avg 1.25, gap 1.5
      ["Tight", 1.5, 1],   // avg 1.25, gap 0.5
    ]);
    expect(findSharedHater(films)?.title).toBe("Tight");
  });

  it("returns null when no film qualifies (no shared dislike)", () => {
    const films = namedPair([
      ["Liked",  4, 4],     // both above threshold
      ["Split",  3, 1],     // user1 above threshold
      ["Split2", 1, 3],     // user2 above threshold
    ]);
    expect(findSharedHater(films)).toBeNull();
  });

  it("returns null for empty input", () => {
    expect(findSharedHater([])).toBeNull();
  });

  it("uses 2.0 as the qualifying threshold (mirror of DARLING_MIN_RATING)", () => {
    const films = namedPair([
      ["Boundary just above", 2.5, 1], // user1 above threshold
      ["Boundary at",         2, 2],   // exactly at threshold, both qualify
    ]);
    expect(findSharedHater(films)?.title).toBe("Boundary at");
    expect(HATER_MAX_RATING).toBe(2.0);
  });

  it("ignores non-finite ratings", () => {
    const films: NamedFilm[] = [
      { title: "Bad",  user1_rating: NaN, user2_rating: 1 },
      { title: "Hate", user1_rating: 1,   user2_rating: 1 },
    ];
    expect(findSharedHater(films)?.title).toBe("Hate");
  });

  it("ignores films either user hasn't rated (rating 0)", () => {
    const films = namedPair([
      ["Unrated", 1, 0],   // user2 hasn't rated
      ["Hate",    1, 1.5], // legitimate shared dislike
    ]);
    expect(findSharedHater(films)?.title).toBe("Hate");
  });

  it("preserves caller's full object shape (generic over T)", () => {
    interface FilmWithSlug extends RatedFilm {
      slug: string;
    }
    const films: FilmWithSlug[] = [
      { slug: "hater", user1_rating: 1, user2_rating: 1 },
    ];
    expect(findSharedHater(films)?.slug).toBe("hater");
  });

  it("ties on score: prefers film with fewer total_ratings (more distinctive)", () => {
    interface ScoredFilm extends RatedFilm {
      title: string;
      total_ratings: number;
    }
    const films: ScoredFilm[] = [
      { title: "Popular flop", user1_rating: 1, user2_rating: 1, total_ratings: 1500 },
      { title: "Niche flop",   user1_rating: 1, user2_rating: 1, total_ratings: 30 },
    ];
    expect(findSharedHater(films)?.title).toBe("Niche flop");
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
