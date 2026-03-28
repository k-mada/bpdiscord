import {
  parseRatingFromTitle,
  extractRatingCount,
} from "../../shared/utilities";
import {
  parseRatingFromTitleCases,
  extractRatingCountCases,
} from "../../shared/testFixtures/ratingTestCases";

describe("parseRatingFromTitle", () => {
  it.each(parseRatingFromTitleCases)("$description", ({ input, expected }) => {
    // Client signature is (title: string), but handles falsy values at runtime
    expect(parseRatingFromTitle(input as string)).toBe(expected);
  });
});

describe("extractRatingCount", () => {
  it.each(extractRatingCountCases)("$description", ({ input, expected }) => {
    expect(extractRatingCount(input)).toBe(expected);
  });
});
