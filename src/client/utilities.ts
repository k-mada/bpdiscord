import { parseRatingFromTitle, extractRatingCount } from "../shared/utilities";

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

/** Ascending, nulls lowest; equal returns 0 so a stable sort keeps prior order. */
export function compareNullable<T extends number | string>(
  a: T | null,
  b: T | null,
): number {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a < b ? -1 : 1;
}

/** Renders a Postgres date (YYYY-MM-DD) without letting a timezone shift it. */
export function formatReleaseDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!year || !month || !day) return isoDate;
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}
