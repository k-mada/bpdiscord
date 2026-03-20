import { describe, it, expect } from "vitest";
import {
  parseRatingFromTitle,
  extractRatingCount,
  parseNumberFromText,
  parseStarRating,
  buildFilmsPageUrl,
  formatFilmsResponse,
} from "../utilities";

describe("parseRatingFromTitle", () => {
  it("parses 5-star rating", () => {
    expect(parseRatingFromTitle("★★★★★")).toBe(5);
  });

  it("parses 4.5-star rating", () => {
    expect(parseRatingFromTitle("★★★★½")).toBe(4.5);
  });

  it("parses 3.5-star rating", () => {
    expect(parseRatingFromTitle("★★★½")).toBe(3.5);
  });

  it("parses 1-star rating", () => {
    expect(parseRatingFromTitle("★")).toBe(1);
  });

  it("parses half-star rating", () => {
    expect(parseRatingFromTitle("½")).toBe(0.5);
  });

  it("returns 0 for undefined", () => {
    expect(parseRatingFromTitle(undefined)).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(parseRatingFromTitle("")).toBe(0);
  });

  it("returns 0 for text with no stars", () => {
    expect(parseRatingFromTitle("no rating")).toBe(0);
  });

  it("cleans HTML entities before matching", () => {
    expect(parseRatingFromTitle("★★★★&nbsp;rated")).toBe(4);
  });
});

describe("extractRatingCount", () => {
  it("extracts simple number", () => {
    expect(extractRatingCount("500")).toBe(500);
  });

  it("extracts comma-separated number", () => {
    expect(extractRatingCount("1,234")).toBe(1234);
  });

  it("extracts number with trailing text", () => {
    expect(extractRatingCount("1,234 ratings")).toBe(1234);
  });

  it("extracts large comma-separated number", () => {
    expect(extractRatingCount("1,234,567 ratings")).toBe(1234567);
  });

  it("returns 0 for undefined", () => {
    expect(extractRatingCount(undefined)).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(extractRatingCount("")).toBe(0);
  });

  it("returns 0 for non-numeric string", () => {
    expect(extractRatingCount("no numbers")).toBe(0);
  });
});

describe("parseNumberFromText", () => {
  it("parses plain number", () => {
    expect(parseNumberFromText("500")).toBe(500);
  });

  it("parses number with commas", () => {
    expect(parseNumberFromText("1,000")).toBe(1000);
  });

  it("parses K suffix (lowercase)", () => {
    expect(parseNumberFromText("1.2k")).toBe(1200);
  });

  it("parses K suffix (uppercase)", () => {
    expect(parseNumberFromText("1.2K")).toBe(1200);
  });

  it("parses whole K suffix", () => {
    expect(parseNumberFromText("5K")).toBe(5000);
  });

  it("parses M suffix (lowercase)", () => {
    expect(parseNumberFromText("5.5m")).toBe(5500000);
  });

  it("parses M suffix (uppercase)", () => {
    expect(parseNumberFromText("5.5M")).toBe(5500000);
  });

  it("parses whole M suffix", () => {
    expect(parseNumberFromText("2M")).toBe(2000000);
  });

  it("returns 0 for empty string", () => {
    expect(parseNumberFromText("")).toBe(0);
  });

  it("returns 0 for non-numeric text", () => {
    expect(parseNumberFromText("abc")).toBe(0);
  });
});

describe("parseStarRating", () => {
  it("parses 5-star text", () => {
    expect(parseStarRating("★★★★★")).toBe(5);
  });

  it("parses 4.5-star text", () => {
    expect(parseStarRating("★★★★½")).toBe(4.5);
  });

  it("parses 3-star text", () => {
    expect(parseStarRating("★★★")).toBe(3);
  });

  it("parses 2.5-star text", () => {
    expect(parseStarRating("★★½")).toBe(2.5);
  });

  it("parses 0.5-star text", () => {
    expect(parseStarRating("½")).toBe(0.5);
  });

  it("returns 0 for undefined", () => {
    expect(parseStarRating(undefined)).toBe(0);
  });

  it("returns 0 for empty string", () => {
    expect(parseStarRating("")).toBe(0);
  });

  it("returns 0 for text with no stars", () => {
    expect(parseStarRating("no rating")).toBe(0);
  });

  it("handles whitespace around stars", () => {
    expect(parseStarRating("  ★★★  ")).toBe(3);
  });
});

describe("buildFilmsPageUrl", () => {
  it("builds page 1 URL without page number", () => {
    expect(buildFilmsPageUrl("alice", 1)).toBe(
      "https://letterboxd.com/alice/films"
    );
  });

  it("builds page 2+ URL with page number", () => {
    expect(buildFilmsPageUrl("alice", 2)).toBe(
      "https://letterboxd.com/alice/films/page/2"
    );
  });

  it("builds URL for large page numbers", () => {
    expect(buildFilmsPageUrl("bob", 50)).toBe(
      "https://letterboxd.com/bob/films/page/50"
    );
  });
});

describe("formatFilmsResponse", () => {
  it("returns correct response shape", () => {
    const films = [{ title: "Film 1" }, { title: "Film 2" }];
    const result = formatFilmsResponse("alice", films, "Success", "database");

    expect(result).toEqual({
      message: "Success",
      data: {
        username: "alice",
        films,
        totalFilms: 2,
        source: "database",
        success: true,
        timestamp: expect.any(String),
      },
    });
  });

  it("handles empty films array", () => {
    const result = formatFilmsResponse("bob", [], "No films", "scraped");

    expect(result).toEqual({
      message: "No films",
      data: {
        username: "bob",
        films: [],
        totalFilms: 0,
        source: "scraped",
        success: true,
        timestamp: expect.any(String),
      },
    });
  });

  it("includes ISO timestamp", () => {
    const result = formatFilmsResponse("alice", [], "test", "database") as any;
    // Verify it's a valid ISO date string
    expect(() => new Date(result.data.timestamp)).not.toThrow();
    expect(new Date(result.data.timestamp).toISOString()).toBe(
      result.data.timestamp
    );
  });
});
