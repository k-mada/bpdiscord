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
