import { STAR_PATTERNS } from "./constants";

/**
 * Parse rating from title text containing star symbols
 */
export const parseRatingFromTitle = (title: string | undefined): number => {
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

/**
 * Extract count from title text (handles comma-separated numbers)
 */
export const extractRatingCount = (title: string | undefined): number => {
  if (!title) return 0;
  const match = title.match(/^([\d,]+)/);
  if (!match || !match[1]) return 0;
  // Remove commas and parse as integer
  const numberStr = match[1].replace(/,/g, "");
  return parseInt(numberStr, 10) || 0;
};

/**
 * Parse numbers from text with K/M suffixes (e.g., "1.2K" -> 1200)
 */
export const parseNumberFromText = (text: string): number => {
  if (!text) return 0;

  // Remove commas and convert to lowercase for easier parsing
  const cleanText = text.replace(/,/g, "").toLowerCase();

  // Handle "k" suffix (thousands)
  if (cleanText.includes("k")) {
    const number = parseFloat(cleanText.replace("k", ""));
    return Math.round(number * 1000);
  }

  // Handle "m" suffix (millions)
  if (cleanText.includes("m")) {
    const number = parseFloat(cleanText.replace("m", ""));
    return Math.round(number * 1000000);
  }

  // Regular number
  const number = parseInt(cleanText, 10);
  return isNaN(number) ? 0 : number;
};

/**
 * Parse star rating from text (for film ratings)
 * Note: This function must be self-contained as it's serialized for browser context
 */
export const parseStarRating = (ratingText: string | undefined): number => {
  if (!ratingText) return 0;

  const text = ratingText.trim();

  // Inline star patterns (must be self-contained for browser context)
  const patterns = [
    { pattern: "★★★★★", rating: 5 },
    { pattern: "★★★★½", rating: 4.5 },
    { pattern: "★★★★", rating: 4 },
    { pattern: "★★★½", rating: 3.5 },
    { pattern: "★★★", rating: 3 },
    { pattern: "★★½", rating: 2.5 },
    { pattern: "★★", rating: 2 },
    { pattern: "★½", rating: 1.5 },
    { pattern: "★", rating: 1 },
    { pattern: "½", rating: 0.5 },
  ];

  for (const { pattern, rating } of patterns) {
    if (text.includes(pattern)) {
      return rating;
    }
  }
  return 0;
};

/**
 * Detect if a film is liked based on container element
 */
export const detectLikedStatus = (
  container: Element,
  index: number
): boolean => {
  let liked = false;

  // Strategy 1: Exact match for the provided structure
  const exactLikedElement = container.querySelector(
    "span.like.liked-micro.has-icon.icon-liked.icon-16"
  );
  if (exactLikedElement) {
    liked = true;
    console.log(`Film ${index}: Found liked via exact match`);
  } else {
    // Strategy 2: Check for presence of multiple class combinations
    const likedElement =
      container.querySelector("span.like.liked-micro") ||
      container.querySelector("span.icon-liked") ||
      container.querySelector(".liked-micro.icon-liked");

    if (likedElement) {
      // Verify it has the expected classes
      const classList = likedElement.className;
      if (
        classList.includes("liked-micro") &&
        classList.includes("icon-liked")
      ) {
        liked = true;
        console.log(`Film ${index}: Found liked via class combination`);
      }
    }

    // Strategy 3: Fallback - look for any element with liked-related classes
    if (!liked) {
      const fallbackLiked = container.querySelector("[class*='liked']");
      if (fallbackLiked && fallbackLiked.className.includes("icon-liked")) {
        liked = true;
        console.log(`Film ${index}: Found liked via fallback`);
      }
    }
  }

  return liked;
};

/**
 * Build Letterboxd films page URL
 */
export const buildFilmsPageUrl = (
  username: string,
  pageNum: number
): string => {
  return pageNum === 1
    ? `https://letterboxd.com/${username}/films`
    : `https://letterboxd.com/${username}/films/page/${pageNum}`;
};

/**
 * Extract title from element using various attribute strategies
 */
export const extractTitleFromElement = ($element: any): string | null => {
  const possibleAttributes = ["data-original-title", "title", "aria-label"];

  for (const attr of possibleAttributes) {
    const value = $element.attr(attr) || $element.find("a").attr(attr);
    if (value) return value;
  }

  const text = $element.text().trim();
  if (
    text &&
    (text.includes("★") || text.includes("star") || text.includes("rating"))
  ) {
    return text;
  }

  return null;
};

/**
 * Validate user profile page content
 */
export const validateUserProfile = ($: any, username: string): void => {
  // Check for specific error indicators, excluding common UI elements like "errormessage" divs
  const errorIndicators = $(
    '.error-page, .not-found, [class="404"], [class="error-404"]'
  );
  if (errorIndicators.length > 0) {
    throw new Error(`User profile not found: ${username}`);
  }

  // Check page title for obvious errors
  const pageTitle = $("title").text();
  if (
    pageTitle &&
    (pageTitle.toLowerCase().includes("page not found") ||
      pageTitle.includes("404") ||
      pageTitle.toLowerCase().includes("error"))
  ) {
    throw new Error(`Invalid page title indicates user not found: ${username}`);
  }

  // Check for basic page content
  const bodyText = $("body").text();
  if (!bodyText || bodyText.length < 100) {
    throw new Error(`Insufficient page content for user: ${username}`);
  }

  console.log(`Profile validation passed for user: ${username}`);
};

/**
 * Validate user profile page content
 */
export const validateFilmPage = ($: any, filmSlug: string): void => {
  // Check for specific error indicators, excluding common UI elements like "errormessage" divs
  const errorIndicators = $(
    '.error-page, .not-found, [class="404"], [class="error-404"]'
  );
  if (errorIndicators.length > 0) {
    throw new Error(`Film not found: ${filmSlug}`);
  }

  // Check page title for obvious errors
  const pageTitle = $("title").text();
  if (
    pageTitle &&
    (pageTitle.toLowerCase().includes("page not found") ||
      pageTitle.includes("404") ||
      pageTitle.toLowerCase().includes("error"))
  ) {
    throw new Error(`Invalid page title indicates film not found: ${filmSlug}`);
  }

  // Check for basic page content
  const bodyText = $("body").text();
  if (!bodyText || bodyText.length < 100) {
    throw new Error(`Insufficient page content for film: ${filmSlug}`);
  }

  console.log(`Profile validation passed for film: ${filmSlug}`);
};

/**
 * Find ratings section using multiple selector strategies
 */
export const findRatingsSection = ($: any): any => {
  const selectors = [
    "section.ratings-histogram-chart",
    ".ratings-histogram-chart",
    "[class*='rating-stats']",
    "[class*='rating-distribution']",
    "section[class*='rating']",
    "div[class*='rating']",
    "[class*='rating']",
  ];

  for (const selector of selectors) {
    const section = $(selector);
    if (section.length > 0) {
      return section;
    }
  }

  throw new Error("No ratings section found on page");
};

/**
 * Extract ratings data from ratings section
 */
export const extractRatingsData = (
  $: any,
  ratingsSection: any
): Array<{ rating: number; count: number }> => {
  const barSelectors = [
    "li.rating-histogram-bar",
    ".rating-histogram-bar",
    "li[class*='rating'][class*='histogram']",
    ".rating-bar",
    "[class*='rating'][class*='bar']",
    "li[class*='histogram']",
    "a[class*='rating']",
    "li[class*='rating']",
    "a[href*='rating']",
  ];

  let ratingBars: any | null = null;

  for (const selector of barSelectors) {
    ratingBars = ratingsSection.find(selector);
    if (ratingBars.length > 0) {
      console.log(
        `Found ${ratingBars.length} rating bars with selector: ${selector}`
      );
      break;
    }
  }

  if (!ratingBars || ratingBars.length === 0) {
    throw new Error("No rating bars found in ratings section");
  }

  const ratings: Array<{ rating: number; count: number }> = [];

  ratingBars.each((index: number, element: any) => {
    const $element = $(element);
    const title = extractTitleFromElement($element);

    if (title) {
      const rating = parseRatingFromTitle(title);
      const count = extractRatingCount(title);

      if (rating > 0) {
        ratings.push({ rating, count });
      }
    }
  });

  return ratings;
};

/**
 * Format API response for films data
 */
export const formatFilmsResponse = (
  username: string,
  films: any[],
  message: string,
  source: string
): object => {
  return {
    message,
    data: {
      username,
      films,
      totalFilms: films.length,
      source,
      success: true,
      timestamp: new Date().toISOString(),
    },
  };
};

/**
 * Create delay promise
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Force garbage collection if available
 */
export const forceGarbageCollection = (): void => {
  if (global.gc) {
    global.gc();
  }
};

/**
 * Verify if a Letterboxd user exists
 * Optimized for speed by using a HEAD request to check HTTP status codes.
 * Letterboxd reliably returns 404 for non-existent users.
 *
 * @param username - Letterboxd username to verify
 * @returns Promise<boolean> - true if user exists (200), false if not (404)
 */
export const verifyLetterboxdUserExists = async (username: string): Promise<boolean> => {
  const url = `https://letterboxd.com/${username}`;

  try {
    const axios = (await import('axios')).default;

    const response = await axios.head(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      },
      maxRedirects: 5,
      timeout: 5000, // 5 second timeout
      validateStatus: (status) => status < 500, // Don't throw on 404
    });

    // Letterboxd returns proper HTTP status codes
    return response.status === 200;

  } catch (error) {
    // Network errors, timeouts, etc.
    console.error(`Error verifying user ${username}:`, error);
    // On error, return false to prevent trying to scrape non-existent user
    return false;
  }
};
