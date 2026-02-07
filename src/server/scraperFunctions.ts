/// <reference lib="dom" />
import { EventEmitter } from "events";
import * as cheerio from "cheerio";
import {
  dbUpsertUserRatings,
  dbUpsertUserProfile,
  dbUpsertLBFilmRatings,
} from "./controllers/dataController";
import {
  BLOCKED_RESOURCES,
  BROWSER_HEADERS,
  BROWSER_CONFIG,
  CHROME_ARGS,
  LETTERBOXD_SELECTORS,
  LOADING_STRATEGIES,
  USER_AGENT,
} from "./constants";
import {
  buildFilmsPageUrl,
  delay,
  detectLikedStatus,
  extractRatingsData,
  findRatingsSection,
  forceGarbageCollection,
  parseNumberFromText,
  parseStarRating,
  validateUserProfile,
  validateFilmPage,
} from "./utilities";
import { UserFilm } from "./types";
// Interfaces
export interface UserProfileData {
  displayName: string;
  followers: number;
  following: number;
  numberOfLists: number;
}

// Browser management state
let browserInstance: any | null = null;
let browserPromise: Promise<any> | null = null;
let cleanupTimeout: NodeJS.Timeout | null = null;

/**
 * Get or create browser instance (reuse for performance)
 */
export const getBrowser = async (): Promise<any> => {
  if (browserInstance && browserInstance.isConnected()) {
    if (cleanupTimeout) {
      clearTimeout(cleanupTimeout);
    }
    scheduleCleanup();
    return browserInstance;
  }

  // Prevent multiple browser launches
  if (browserPromise) {
    return browserPromise;
  }

  browserPromise = createBrowser();
  browserInstance = await browserPromise;
  browserPromise = null;
  scheduleCleanup();
  return browserInstance;
};

function scheduleCleanup() {
  cleanupTimeout = setTimeout(
    async () => {
      console.log("Closing idle browser after 5 minutes");
      await cleanup();
    },
    5 * 60 * 1000,
  );
}

/**
 * Create new browser instance with optimized configuration
 * Uses puppeteer-extra with stealth plugin to bypass Cloudflare bot detection
 */
const createBrowser = async (): Promise<any> => {
  let puppeteer: any = null;
  let launchOptions: any = {
    headless: true,
  };

  if (process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    // Use puppeteer-extra with stealth plugin for production
    const puppeteerExtra = (await import("puppeteer-extra")).default;
    const StealthPlugin = (await import("puppeteer-extra-plugin-stealth"))
      .default;
    puppeteerExtra.use(StealthPlugin());

    // Override launch to use chromium executable
    puppeteer = {
      launch: (options: any) =>
        puppeteerExtra.launch({
          ...options,
          executablePath: chromium.executablePath(),
        }),
    };

    launchOptions = {
      ...launchOptions,
      args: [...chromium.args, ...CHROME_ARGS.MEMORY_OPTIMIZATION],
      defaultViewport: BROWSER_CONFIG.VIEWPORT_MINIMAL,
      timeout: BROWSER_CONFIG.BROWSER_LAUNCH_TIMEOUT,
    };
  } else {
    // Use puppeteer-extra with stealth plugin for local development
    try {
      const puppeteerExtra = (await import("puppeteer-extra")).default;
      const StealthPlugin = (await import("puppeteer-extra-plugin-stealth"))
        .default;
      puppeteerExtra.use(StealthPlugin());
      puppeteer = puppeteerExtra;
    } catch (error) {
      // Fall back to regular puppeteer if puppeteer-extra not available
      puppeteer = (await import("puppeteer")).default;
    }
  }

  console.log("Launching browser with stealth plugin to bypass Cloudflare...");
  return await puppeteer.launch(launchOptions);
};

/**
 * Create optimized page instance
 */
export const createPage = async (): Promise<any> => {
  const browser = await getBrowser();
  const page = await browser.newPage();

  // Set realistic user agent
  await page.setUserAgent(USER_AGENT);

  // Set optimized viewport
  await page.setViewport(
    process.env.VERCEL
      ? BROWSER_CONFIG.VIEWPORT_PRODUCTION
      : BROWSER_CONFIG.VIEWPORT_DEVELOPMENT,
  );

  // Enable request interception for performance optimization in production
  if (process.env.VERCEL) {
    await page.setRequestInterception(true);
    page.on("request", (request: any) => {
      const resourceType = request.resourceType();
      const url = request.url();

      // Block unnecessary resource types and tracking
      if (
        BLOCKED_RESOURCES.PERFORMANCE.includes(resourceType) ||
        BLOCKED_RESOURCES.TRACKING.some((tracker) => url.includes(tracker))
      ) {
        request.abort();
      } else {
        request.continue();
      }
    });
  }

  // Set additional headers
  await page.setExtraHTTPHeaders(BROWSER_HEADERS);

  // Stealth measures
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, "webdriver", {
      get: () => undefined,
    });
    Object.defineProperty(navigator, "chrome", {
      get: () => undefined,
    });
    const originalQuery = window.navigator.permissions.query;
    window.navigator.permissions.query = (parameters) =>
      parameters.name === "notifications"
        ? Promise.resolve({ state: Notification.permission } as any)
        : originalQuery(parameters);
  });

  return page;
};

/**
 * Create page specifically for film scraping (simple headless mode)
 * Uses shared browser instance for better performance
 */
export const createPageForFilmScraping = async (): Promise<any> => {
  const browser = await getBrowser();
  const page = await browser.newPage();

  await page.setUserAgent(USER_AGENT);
  await page.setViewport(
    process.env.VERCEL
      ? BROWSER_CONFIG.VIEWPORT_PRODUCTION
      : BROWSER_CONFIG.VIEWPORT_DEVELOPMENT,
  );

  // Set realistic headers
  await page.setExtraHTTPHeaders({
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    Accept:
      "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
    "Cache-Control": "no-cache",
    Pragma: "no-cache",
  });

  return page;
};

/**
 * Close page and associated browser
 */
export const closePageAndBrowser = async (page: any): Promise<void> => {
  try {
    if (page && !page.isClosed()) {
      const browser = (page as any)._browser;
      await page.close();
      if (browser) {
        await browser.close();
      }
    }
  } catch (error) {
    console.error("Error closing page and browser:", error);
  }
};

/**
 * Load page with retry strategies
 */
export const loadPageWithRetry = async (
  page: any,
  url: string,
  waitUntil: "networkidle2" | "domcontentloaded" | "load" = "networkidle2",
): Promise<void> => {
  console.log(`Loading page: ${url}`);

  const strategies = LOADING_STRATEGIES.map((strategy) => ({
    ...strategy,
    waitUntil:
      strategy.waitUntil === "networkidle2" ? waitUntil : strategy.waitUntil,
  }));

  for (const [index, strategy] of strategies.entries()) {
    try {
      await page.goto(url, strategy);
      console.log(`Successfully loaded page with strategy ${index + 1}`);
      return;
    } catch (error) {
      console.warn(`Strategy ${index + 1} failed:`, error);
      if (index === strategies.length - 1) {
        throw new Error(
          `Failed to load page after ${strategies.length} attempts: ${error}`,
        );
      }
    }
  }
};

/**
 * Wait for page content to load
 */
export const waitForPageContent = async (page: any): Promise<void> => {
  await Promise.race([
    page.waitForSelector("body", {
      timeout: BROWSER_CONFIG.ELEMENT_WAIT_TIMEOUT,
    }),
    delay(BROWSER_CONFIG.CONTENT_WAIT_TIMEOUT),
  ]);
};

/**
 * Browser cleanup
 */
export const cleanup = async (): Promise<void> => {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
};

/**
 * Scrape user ratings from Letterboxd profile
 */
export const scrapeUserRatings = async (
  username: string,
): Promise<Array<{ rating: number; count: number }>> => {
  console.log(`Fetching ratings for ${username} from Letterboxd...`);

  const page = await createPage();
  const url = `https://letterboxd.com/${username}`;

  try {
    await loadPageWithRetry(page, url);
    await waitForPageContent(page);

    const pageContent = await page.content();
    const $ = cheerio.load(pageContent);

    validateUserProfile($, username);
    const ratingsSection = findRatingsSection($);
    const ratings = extractRatingsData($, ratingsSection);

    if (ratings.length === 0) {
      throw new Error("No ratings data could be extracted from the page");
    }

    ratings.sort((a, b) => a.rating - b.rating);
    return ratings;
  } finally {
    await page.close();
  }
};

/**
 * Scrape aggregate rating data from film page JSON-LD
 *
 * NOTE: Film pages are protected by bot detection that blocks the ratings histogram widget.
 * We can only extract aggregate data (average rating, total count) from JSON-LD.
 * Full histogram distribution (ratings by 0.5-5.0) is not available via web scraping.
 */
export const scrapeLBFilmRatings = async (
  filmSlug: string,
): Promise<Array<{ avgRating: number; count: number }>> => {
  console.log(`Fetching aggregate rating data for ${filmSlug} from JSON-LD...`);

  const page = await createPageForFilmScraping();
  const url = `https://letterboxd.com/film/${filmSlug}`;

  try {
    await loadPageWithRetry(page, url, "networkidle2");
    await delay(1000);

    const pageContent = await page.content();
    const $ = cheerio.load(pageContent);

    validateFilmPage($, filmSlug);

    // Extract JSON-LD structured data
    const scriptTag = $("script[type='application/ld+json']").first();
    if (!scriptTag.length) {
      throw new Error("No JSON-LD data found on film page");
    }

    let content = scriptTag.html();
    if (!content) {
      throw new Error("JSON-LD script tag is empty");
    }

    // Strip CDATA wrapper if present
    content = content
      .replace(/\/\*\s*<!\[CDATA\[\s*\*\//, "")
      .replace(/\/\*\s*\]\]>\s*\*\//, "")
      .trim();

    const data = JSON.parse(content);

    if (!data.aggregateRating) {
      throw new Error("No aggregateRating found in JSON-LD data");
    }

    const { ratingValue, ratingCount } = data.aggregateRating;

    console.log(`Successfully extracted aggregate rating for ${filmSlug}:`);
    // console.log(`  Average: ${ratingValue}/5.0`);
    // console.log(`  Total ratings: ${ratingCount.toLocaleString()}`);
    // console.log(
    //   `  (Note: Full histogram distribution not available due to bot detection)`
    // );

    // Return aggregate data as a single entry
    // This is a workaround since we can't get the full 0.5-5.0 distribution
    return [
      {
        avgRating: ratingValue,
        count: ratingCount,
      },
    ];
  } finally {
    await page.close();
  }
};

export const scrapeLBFilmRatingsDistribution = async (
  filmSlug: string,
): Promise<Array<{ rating: number; count: number }>> => {
  const page = await createPageForFilmScraping();
  const url = `https://letterboxd.com/csi/film/${filmSlug}/ratings-summary/`;

  try {
    await loadPageWithRetry(page, url, "networkidle2");
    await delay(1000);

    const pageContent = await page.content();
    const $ = cheerio.load(pageContent);

    validateFilmPage($, filmSlug);
    const ratingsSection = findRatingsSection($);
    const ratings = extractRatingsData($, ratingsSection);
    return ratings;
  } finally {
    await page.close();
  }
};

/**
 * Save ratings to database
 */
export const saveRatingsToDatabase = async (
  username: string,
  ratings: Array<{ rating: number; count: number }>,
): Promise<void> => {
  const insertResult = await dbUpsertUserRatings(username, ratings);

  if (!insertResult.success) {
    console.error("Database operation failed:", insertResult.error);
    throw new Error(
      `Failed to save ratings to database: ${insertResult.error}`,
    );
  }

  console.log(
    `Successfully saved ${ratings.length} ratings for user ${username}`,
  );
};

export const saveLBFilmRatingsToDatabase = async (
  filmSlug: string,
  ratings: Array<{ avgRating: number; count: number }>,
): Promise<void> => {
  const insertResult = await dbUpsertLBFilmRatings(filmSlug, ratings);

  if (!insertResult.success) {
    console.error("Database operation failed:", insertResult.error);
    throw new Error(
      `Failed to save ratings to database: ${insertResult.error}`,
    );
  }

  console.log(
    `Successfully saved ${ratings.length} ratings for user ${filmSlug}`,
  );
};

/**
 * Scrape user profile data
 */
export const scrapeUserProfileData = async (
  username: string,
): Promise<UserProfileData> => {
  console.log(`Fetching profile data for ${username} from Letterboxd...`);

  const page = await createPage();
  const url = `https://letterboxd.com/${username}`;

  try {
    await loadPageWithRetry(page, url);
    await waitForPageContent(page);

    const pageContent = await page.content();
    const $ = cheerio.load(pageContent);

    validateUserProfile($, username);

    // Extract profile data using constants
    const followersElement = $(LETTERBOXD_SELECTORS.FOLLOWERS);
    const followersText = followersElement.text().trim();
    const followers = parseNumberFromText(followersText);

    const followingElement = $(LETTERBOXD_SELECTORS.FOLLOWING);
    const followingText = followingElement.text().trim();
    const following = parseNumberFromText(followingText);

    const listsElement = $(LETTERBOXD_SELECTORS.LISTS);
    const listsText = listsElement.text().trim();
    const numberOfLists = parseNumberFromText(listsText);

    const displayNameElement = $(LETTERBOXD_SELECTORS.DISPLAY_NAME);
    let displayName = displayNameElement.text().trim();

    if (!displayName) {
      displayName = username;
    }

    console.log(
      `Profile data extracted: displayName="${displayName}", followers=${followers}, following=${following}, numberOfLists=${numberOfLists}`,
    );

    return {
      displayName,
      followers,
      following,
      numberOfLists,
    };
  } finally {
    await page.close();
  }
};

/**
 * Save profile data to database
 */
export const saveProfileToDatabase = async (
  username: string,
  profileData: UserProfileData,
): Promise<void> => {
  try {
    console.log(
      `Saving profile data for ${username} to database:`,
      profileData,
    );

    const result = await dbUpsertUserProfile(username, profileData);

    if (!result.success) {
      console.error("Database operation failed:", result.error);
      throw new Error(`Failed to save profile to database: ${result.error}`);
    }

    console.log(`Successfully saved profile data for user ${username}`);
  } catch (error) {
    console.error("Error saving profile to database:", error);
    throw new Error(`Failed to save profile to database: ${error}`);
  }
};

/**
 * Extract films from page using optimized evaluation
 */
export const extractFilmsFromPage = async (page: any): Promise<UserFilm[]> => {
  return await page.evaluate(
    (parseStarRatingStr: string, detectLikedStatusStr: string) => {
      const parseStarRating = new Function(
        "ratingText",
        parseStarRatingStr,
      ) as (ratingText: string | undefined) => number;
      const detectLikedStatus = new Function(
        "container",
        "index",
        detectLikedStatusStr,
      ) as (container: Element, index: number) => boolean;

      const films: UserFilm[] = [];
      const filmContainers = document.querySelectorAll("li.griditem");
      console.log(`Found ${filmContainers.length} film containers on page`);

      filmContainers.forEach((container, index) => {
        const filmDiv = container.querySelector("div[data-item-slug]");
        const filmSlug = filmDiv?.getAttribute("data-item-slug");
        const filmTitle = filmDiv?.getAttribute("data-item-name");

        if (filmSlug && filmTitle) {
          const ratingElement = container.querySelector(
            "p.poster-viewingdata span.rating",
          );
          const ratingText = ratingElement?.textContent?.trim();
          const rating = parseStarRating(ratingText);
          const liked = detectLikedStatus(container, index);

          const film: UserFilm = {
            film_slug: filmSlug,
            title: filmTitle,
            rating: rating,
            liked: liked,
          };

          films.push(film);
        }
      });

      return films;
    },
    parseStarRating.toString().match(/{([\s\S]*)}$/)?.[1] || "",
    detectLikedStatus.toString().match(/{([\s\S]*)}$/)?.[1] || "",
  );
};

/**
 * Extract total pages from pagination
 */
export const extractTotalPages = async (
  page: any,
  username: string,
): Promise<number> => {
  try {
    await page.waitForSelector("div.paginate-pages", {
      timeout: BROWSER_CONFIG.PAGINATION_TIMEOUT,
    });
    const numberOfPages = await page.$eval(
      "div.paginate-pages > ul > li:last-child > a",
      (element: Element) => element.textContent,
    );
    const totalPages = Number(numberOfPages) || 1;
    console.log(`Found ${totalPages} total pages for ${username}`);
    return totalPages;
  } catch (error) {
    console.log("No pagination found, treating as single page");
    return 1;
  }
};

/**
 * Scrape single films page
 */
export const scrapeFilmsPage = async (
  username: string,
  pageNum: number,
): Promise<{ films: UserFilm[]; totalPages: number }> => {
  const page = await createPageForFilmScraping();

  try {
    const url = buildFilmsPageUrl(username, pageNum);
    await loadPageWithRetry(page, url);

    let totalPages = 1;
    if (pageNum === 1) {
      totalPages = await extractTotalPages(page, username);
    }

    const filmsData = await extractFilmsFromPage(page);

    console.log(
      `Fetched ${filmsData.length} films from page ${pageNum}, ${
        filmsData.filter((f) => f.liked).length
      } liked`,
    );

    return { films: filmsData, totalPages };
  } finally {
    await page.close();
  }
};

/**
 * Scrape all user films
 */
export const scrapeUserFilms = async (
  username: string,
): Promise<UserFilm[]> => {
  const startTime = Date.now();
  console.log(
    `Starting film fetching for ${username} at ${new Date().toISOString()}`,
  );

  const films: UserFilm[] = [];

  try {
    const firstPageData = await scrapeFilmsPage(username, 1);
    films.push(...firstPageData.films);

    console.log(`Found ${firstPageData.totalPages} total pages to fetch`);

    for (let page = 2; page <= firstPageData.totalPages; page++) {
      const pageStartTime = Date.now();
      console.log(
        `Scraping page ${page} of ${firstPageData.totalPages} for ${username} (${films.length} films collected so far)`,
      );

      const pageData = await scrapeFilmsPage(username, page);
      films.push(...pageData.films);

      const pageTime = Date.now() - pageStartTime;
      console.log(
        `Page ${page} completed in ${pageTime}ms, collected ${pageData.films.length} films`,
      );

      await delay(BROWSER_CONFIG.FILM_SCRAPING_DELAY);
    }

    const totalTime = Date.now() - startTime;
    console.log(
      `Completed fetching ${
        films.length
      } films for ${username} in ${totalTime}ms (${
        films.filter((f) => f.liked).length
      } liked)`,
    );

    return films;
  } catch (error) {
    const totalTime = Date.now() - startTime;
    console.error(
      `Film fetching failed for ${username} after ${totalTime}ms:`,
      error,
    );
    throw error;
  }
};

/**
 * Progress-enabled film scraping with memory optimization
 */
export const scrapeUserFilmsWithProgress = async (
  username: string,
  progressEmitter: EventEmitter,
): Promise<UserFilm[]> => {
  const startTime = Date.now();
  progressEmitter.emit("progress", {
    type: "init",
    message: `Starting film fetching for ${username}`,
    timestamp: new Date().toISOString(),
  });

  const films: UserFilm[] = [];
  let sharedBrowser: any = null;

  try {
    progressEmitter.emit("progress", {
      type: "browser_launch",
      message: "Launching browser for film scraping session...",
      timestamp: new Date().toISOString(),
    });

    sharedBrowser = await createBrowser();

    progressEmitter.emit("progress", {
      type: "fetching_first_page",
      message: "Fetching first page to determine total pages...",
      timestamp: new Date().toISOString(),
    });

    const firstPageData = await scrapeFilmsPageWithMemoryCleanup(
      username,
      1,
      sharedBrowser,
      progressEmitter,
    );
    films.push(...firstPageData.films);

    progressEmitter.emit("progress", {
      type: "pages_found",
      message: `Found ${firstPageData.totalPages} total pages to scrape`,
      totalPages: firstPageData.totalPages,
      filmsFromFirstPage: firstPageData.films.length,
      timestamp: new Date().toISOString(),
    });

    for (let page = 2; page <= firstPageData.totalPages; page++) {
      progressEmitter.emit("progress", {
        type: "page_start",
        message: `Scraping page ${page} of ${firstPageData.totalPages}`,
        currentPage: page,
        totalPages: firstPageData.totalPages,
        filmsCollectedSoFar: films.length,
        timestamp: new Date().toISOString(),
      });

      const pageData = await scrapeFilmsPageWithMemoryCleanup(
        username,
        page,
        sharedBrowser,
        progressEmitter,
      );

      films.push(...pageData.films);

      progressEmitter.emit("progress", {
        type: "page_complete",
        message: `Completed page ${page} of ${firstPageData.totalPages}`,
        currentPage: page,
        totalPages: firstPageData.totalPages,
        filmsFromThisPage: pageData.films.length,
        filmsCollectedSoFar: films.length,
        timestamp: new Date().toISOString(),
      });

      // Use longer delay in production to avoid Cloudflare rate limiting
      const delayMs = process.env.VERCEL ? 3000 : BROWSER_CONFIG.MEMORY_CLEANUP_DELAY;
      await delay(delayMs);

      if (page % BROWSER_CONFIG.MEMORY_CLEANUP_INTERVAL === 0) {
        forceGarbageCollection();
        progressEmitter.emit("progress", {
          type: "memory_cleanup",
          message: `Memory cleanup after page ${page}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    const totalTime = Date.now() - startTime;
    progressEmitter.emit("progress", {
      type: "scraping_complete",
      message: `Film fetching completed in ${totalTime}ms`,
      totalFilms: films.length,
      totalTimeMs: totalTime,
      timestamp: new Date().toISOString(),
    });

    return films;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    progressEmitter.emit("progress", {
      type: "error",
      message: `Error during film fetching: ${errorMessage}`,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    throw error;
  } finally {
    if (sharedBrowser) {
      try {
        await sharedBrowser.close();
        progressEmitter.emit("progress", {
          type: "cleanup",
          message: "Browser cleanup completed",
          timestamp: new Date().toISOString(),
        });
      } catch (cleanupError) {
        console.error("Browser cleanup error:", cleanupError);
      }
    }
  }
};

/**
 * Memory-efficient page scraping with fresh pages
 */
export const scrapeFilmsPageWithMemoryCleanup = async (
  username: string,
  pageNum: number,
  browser: any,
  progressEmitter: EventEmitter,
): Promise<{ films: UserFilm[]; totalPages: number }> => {
  let page: any = null;

  try {
    page = await browser.newPage();

    // Apply stealth measures to avoid bot detection
    await page.setUserAgent(USER_AGENT);
    await page.setViewport(
      process.env.VERCEL
        ? BROWSER_CONFIG.VIEWPORT_PRODUCTION
        : BROWSER_CONFIG.VIEWPORT_DEVELOPMENT,
    );
    await page.setExtraHTTPHeaders(BROWSER_HEADERS);

    // Stealth JavaScript to hide automation markers
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });
      Object.defineProperty(navigator, "chrome", {
        get: () => undefined,
      });
      // Also override permissions API like createPage() does
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission } as any)
          : originalQuery(parameters);
    });

    // Request interception with both memory optimization and tracking blocking
    await page.setRequestInterception(true);
    page.on("request", (req: any) => {
      const resourceType = req.resourceType();
      const url = req.url();

      // Block memory-heavy resources AND tracking (like createPage() does in production)
      if (
        BLOCKED_RESOURCES.MEMORY_OPTIMIZATION.includes(resourceType) ||
        (process.env.VERCEL &&
          BLOCKED_RESOURCES.TRACKING.some((tracker) => url.includes(tracker)))
      ) {
        req.abort();
      } else {
        req.continue();
      }
    });

    const url = buildFilmsPageUrl(username, pageNum);
    // Use networkidle2 for better reliability in production
    await loadPageWithRetry(page, url, "networkidle2");
    // Add small delay to ensure dynamic content loads
    await delay(1000);

    let totalPages = 1;
    if (pageNum === 1) {
      totalPages = await extractTotalPages(page, username);
    }

    const films = await extractFilmsFromPage(page);

    // Debug: Log if no films found
    if (films.length === 0 && pageNum > 1) {
      const pageTitle = await page.title();
      const bodyText = await page.evaluate(() => document.body.innerText.substring(0, 200));
      console.warn(`⚠️  Page ${pageNum} returned 0 films. Title: "${pageTitle}", Body preview: "${bodyText}"`);
    }

    progressEmitter.emit("progress", {
      type: "page_scraped",
      message: `Extracted ${films.length} films from page ${pageNum}`,
      currentPage: pageNum,
      filmsFromPage: films.length,
      timestamp: new Date().toISOString(),
    });

    return { films, totalPages };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    progressEmitter.emit("progress", {
      type: "page_error",
      message: `Error on page ${pageNum}: ${errorMessage}`,
      currentPage: pageNum,
      error: errorMessage,
      timestamp: new Date().toISOString(),
    });
    throw error;
  } finally {
    if (page) {
      try {
        await page.close();
      } catch (cleanupError) {
        console.error(`Page cleanup error for page ${pageNum}:`, cleanupError);
      }
    }
  }
};

// Export browser management functions for module-level state
export { browserInstance, browserPromise };
