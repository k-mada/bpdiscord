/**
 * Shared test cases for parseRatingFromTitle and extractRatingCount.
 *
 * Both client (src/client/utilities.ts) and server (src/server/utilities.ts)
 * implement these functions independently. This file provides a single source
 * of truth for the expected behavior so both test suites stay in sync.
 */

export const parseRatingFromTitleCases: Array<{
  description: string;
  input: string | undefined;
  expected: number;
}> = [
  { description: "parses 5-star rating", input: "★★★★★", expected: 5 },
  { description: "parses 4.5-star rating", input: "★★★★½", expected: 4.5 },
  { description: "parses 4-star rating", input: "★★★★", expected: 4 },
  { description: "parses 3.5-star rating", input: "★★★½", expected: 3.5 },
  { description: "parses 3-star rating", input: "★★★", expected: 3 },
  { description: "parses 2.5-star rating", input: "★★½", expected: 2.5 },
  { description: "parses 2-star rating", input: "★★", expected: 2 },
  { description: "parses 1.5-star rating", input: "★½", expected: 1.5 },
  { description: "parses 1-star rating", input: "★", expected: 1 },
  { description: "parses half-star rating", input: "½", expected: 0.5 },
  { description: "returns 0 for empty string", input: "", expected: 0 },
  { description: "returns 0 for undefined", input: undefined, expected: 0 },
  { description: "returns 0 for text with no stars", input: "no rating here", expected: 0 },
  { description: "handles title with HTML entities", input: "★★★★&nbsp;rated", expected: 4 },
  { description: "handles title with surrounding text", input: "Rated ★★★½ by user", expected: 3.5 },
];

export const extractRatingCountCases: Array<{
  description: string;
  input: string | undefined;
  expected: number;
}> = [
  { description: "extracts simple number", input: "500", expected: 500 },
  { description: "extracts comma-separated number", input: "1,234", expected: 1234 },
  { description: "extracts number with trailing text", input: "1,234 ratings", expected: 1234 },
  { description: "extracts large comma-separated number", input: "1,234,567 ratings", expected: 1234567 },
  { description: "returns 0 for undefined", input: undefined, expected: 0 },
  { description: "returns 0 for empty string", input: "", expected: 0 },
  { description: "returns 0 for non-numeric string", input: "no numbers", expected: 0 },
];
