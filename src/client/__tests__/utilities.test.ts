import {
  parseRatingFromTitle,
  extractRatingCount,
} from "../utilities";

describe("parseRatingFromTitle", () => {
  it("parses 5-star rating", () => {
    expect(parseRatingFromTitle("★★★★★")).toBe(5);
  });

  it("parses 4.5-star rating", () => {
    expect(parseRatingFromTitle("★★★★½")).toBe(4.5);
  });

  it("parses 4-star rating", () => {
    expect(parseRatingFromTitle("★★★★")).toBe(4);
  });

  it("parses 3.5-star rating", () => {
    expect(parseRatingFromTitle("★★★½")).toBe(3.5);
  });

  it("parses 3-star rating", () => {
    expect(parseRatingFromTitle("★★★")).toBe(3);
  });

  it("parses 2.5-star rating", () => {
    expect(parseRatingFromTitle("★★½")).toBe(2.5);
  });

  it("parses 2-star rating", () => {
    expect(parseRatingFromTitle("★★")).toBe(2);
  });

  it("parses 1.5-star rating", () => {
    expect(parseRatingFromTitle("★½")).toBe(1.5);
  });

  it("parses 1-star rating", () => {
    expect(parseRatingFromTitle("★")).toBe(1);
  });

  it("parses half-star rating", () => {
    expect(parseRatingFromTitle("½")).toBe(0.5);
  });

  it("returns 0 for empty string", () => {
    expect(parseRatingFromTitle("")).toBe(0);
  });

  it("returns 0 for undefined", () => {
    expect(parseRatingFromTitle(undefined as any)).toBe(0);
  });

  it("returns 0 for text with no stars", () => {
    expect(parseRatingFromTitle("no rating here")).toBe(0);
  });

  it("handles title with HTML entities", () => {
    expect(parseRatingFromTitle("★★★★&nbsp;rated")).toBe(4);
  });

  it("handles title with surrounding text", () => {
    expect(parseRatingFromTitle("Rated ★★★½ by user")).toBe(3.5);
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

