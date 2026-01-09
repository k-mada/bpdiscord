// Star rating patterns (ordered by priority - longest first)
export const STAR_PATTERNS = [
  { pattern: "★★★★★", rating: 5 },
  { pattern: "★★★★½", rating: 4.5 },
  { pattern: "★★★★", rating: 4 },
  { pattern: "★★★½", rating: 3.5 },
  { pattern: "★★★", rating: 3 },
  { pattern: "★★½", rating: 2.5 },
  { pattern: "★★", rating: 2 },
  { pattern: "★½", rating: 1.5 },
  { pattern: "half-★", rating: 0.5 },
  { pattern: "★", rating: 1 },
  { pattern: "½", rating: 0.5 },
];

export function extractTitleFromElement($element: Element): string {
  const title = $element.getAttribute("title");
  if (
    title &&
    (title.includes("★") || title.includes("star") || title.includes("rating"))
  ) {
    return title;
  }
  return "";
}

export const parseRatingFromTitle = (title: string): number => {
  if (!title) return 0;

  // Handle HTML entities and extract just the star rating part
  const cleanTitle = title.replace(/&nbsp;/g, " ").trim();

  // Look for star patterns in the title (check longer patterns first)
  for (const { pattern, rating } of STAR_PATTERNS) {
    if (cleanTitle.includes(pattern)) {
      return rating;
    }
  }

  return 0;
};

export function extractRatingsData(
  $: Element
): Array<{ rating: number; count: number }> {
  const ratings: Array<{ rating: number; count: number }> = [];
  const ratingBars = $.querySelectorAll("li.rating-histogram-bar > a");
  // for (let i = 0; i < ratingBars.length; i++) {}

  ratingBars.forEach((value) => {
    const title = extractTitleFromElement(value);
    if (title) {
      const rating = parseRatingFromTitle(title);
      const count = extractRatingCount(title);
      if (rating > 0) {
        ratings.push({ rating, count });
      }
    }
  });

  return ratings;
}

/**
 * Extract count from title text (handles comma-separated numbers)
 */
export function extractRatingCount(title: string | undefined): number {
  if (!title) return 0;
  const match = title.match(/^([\d,]+)/);
  if (!match || !match[1]) return 0;
  // Remove commas and parse as integer
  const numberStr = match[1].replace(/,/g, "");
  return parseInt(numberStr, 10) || 0;
}
