// Browser configuration constants
export const BROWSER_CONFIG = {
  // Timeouts
  PAGE_LOAD_TIMEOUT: 60000,
  PAGE_LOAD_TIMEOUT_FAST: 45000,
  PAGE_LOAD_TIMEOUT_SLOW: 90000,
  BROWSER_LAUNCH_TIMEOUT: 30000,
  PAGINATION_TIMEOUT: 10000,
  ELEMENT_WAIT_TIMEOUT: 30000,
  CONTENT_WAIT_TIMEOUT: 10000,

  // Delays
  PAGE_DELAY: 1000,
  FILM_SCRAPING_DELAY: 750,
  MEMORY_CLEANUP_DELAY: 1000,

  // Memory and performance
  MAX_OLD_SPACE_SIZE: 4096,
  MEMORY_CLEANUP_INTERVAL: 5, // Every 5 pages

  // Viewports
  VIEWPORT_PRODUCTION: { width: 1280, height: 720 },
  VIEWPORT_DEVELOPMENT: { width: 1920, height: 1080 },
  VIEWPORT_MINIMAL: { width: 800, height: 600 },

  // Production limits
  PRODUCTION_TIMEOUT: 8 * 60 * 1000, // 8 minutes
  LONG_OPERATION_TIMEOUT: 10 * 60 * 1000, // 10 minutes
  SSE_HEARTBEAT_INTERVAL: 30000, // 30 seconds
};

// Chrome browser arguments for different environments
export const CHROME_ARGS = {
  MEMORY_OPTIMIZATION: [
    "--disable-dev-shm-usage",
    "--disable-extensions",
    "--disable-plugins",
    "--disable-images",
    "--disable-web-security",
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--single-process",
    "--no-zygote",
    "--disable-background-timer-throttling",
    "--disable-backgrounding-occluded-windows",
    "--disable-renderer-backgrounding",
    "--disable-features=TranslateUI",
    "--disable-ipc-flooding-protection",
    `--max_old_space_size=${BROWSER_CONFIG.MAX_OLD_SPACE_SIZE}`,
    "--memory-pressure-off",
    "--disable-background-networking",
    "--disable-default-apps",
    "--disable-sync",
    "--aggressive-cache-discard",
  ],
};

// CSS selectors for different Letterboxd elements
export const LETTERBOXD_SELECTORS = {
  // Rating sections
  RATINGS_SECTIONS: [
    "section.ratings-histogram-chart",
    ".ratings-histogram-chart",
    "[class*='rating-stats']",
    "[class*='rating-distribution']",
    "section[class*='rating']",
    "div[class*='rating']",
    "[class*='rating']",
  ],

  // Rating bars
  RATING_BARS: [
    "li.rating-histogram-bar",
    ".rating-histogram-bar",
    "li[class*='rating'][class*='histogram']",
    ".rating-bar",
    "[class*='rating'][class*='bar']",
    "li[class*='histogram']",
    "a[class*='rating']",
    "li[class*='rating']",
    "a[href*='rating']",
  ],

  // Profile elements
  FOLLOWERS: 'a[href*="/followers/"] .value, a[href$="/followers/"] .value',
  FOLLOWING: 'a[href*="/following/"] .value, a[href$="/following/"] .value',
  LISTS: 'a[href*="/lists/"] .value, a[href$="/lists/"] .value',
  DISPLAY_NAME: "span.displayname",

  // Film elements
  FILM_CONTAINERS: "li.griditem",
  FILM_DATA: "div[data-item-slug]",
  FILM_RATING: "p.poster-viewingdata span.rating",
  PAGINATION: "div.paginate-pages > ul > li:last-child > a",
  PAGINATION_SECTION: "div.paginate-pages",

  // Liked status
  LIKED_EXACT: "span.like.liked-micro.has-icon.icon-liked.icon-16",
  LIKED_GENERAL: "span.like.liked-micro",
  LIKED_ICON: "span.icon-liked",
  LIKED_COMBO: ".liked-micro.icon-liked",
  LIKED_FALLBACK: "[class*='liked']",

  // Error indicators
  ERROR_INDICATORS:
    '.error-page, .not-found, [class="404"], [class="error-404"]',

  // Content containers
  MAIN_CONTENT: "div#content.site-body",
  POSTER_CONTAINER: "li.poster-container",
  RATING_CONTEXT:
    "p.poster-viewingdata > span.rating, .rating, [class*='rating']",
};

// Resource types to block for performance
export const BLOCKED_RESOURCES = {
  PERFORMANCE: ["image", "font", "media"],
  MEMORY_OPTIMIZATION: ["image", "stylesheet", "font", "media"],
  TRACKING: [
    "google-analytics",
    "facebook.com",
    "twitter.com",
    "doubleclick",
    "ads",
    "analytics",
    "track",
  ],
};

// Parent container types for element grouping
export const CONTAINER_TYPES = ["li", "div", "article", "section", "tr"];

// Element attributes to extract
export const ELEMENT_ATTRIBUTES = [
  "data-original-title",
  "title",
  "aria-label",
];

// Loading strategies for page navigation
export const LOADING_STRATEGIES = [
  {
    waitUntil: "domcontentloaded" as const,
    timeout: BROWSER_CONFIG.PAGE_LOAD_TIMEOUT_FAST,
  },
  {
    waitUntil: "networkidle2" as const,
    timeout: BROWSER_CONFIG.PAGE_LOAD_TIMEOUT,
  },
  {
    waitUntil: "load" as const,
    timeout: BROWSER_CONFIG.PAGE_LOAD_TIMEOUT_SLOW,
  },
];

// HTTP headers for realistic browser simulation
export const BROWSER_HEADERS = {
  "Accept-Language": "en-US,en;q=0.9",
  "Accept-Encoding": "gzip, deflate, br",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "none",
  "Upgrade-Insecure-Requests": "1",
};

// User agent string
export const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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
