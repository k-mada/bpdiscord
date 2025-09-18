/// <reference lib="dom" />
import { Request, Response } from "express";
import { EventEmitter } from "events";

import * as cheerio from "cheerio";
import { ApiResponse, ScraperSelector, UserFilm } from "../types";
import { DataController } from "./dataController";
// import { puppeteerErrors } from "puppeteer-core";

interface UserProfileData {
  displayName: string;
  followers: number;
  following: number;
  numberOfLists: number;
}

// Utility functions for rating parsing
const parseRatingFromTitle = (title: string | undefined): number => {
  if (!title) return 0;

  // Handle HTML entities and extract just the star rating part
  const cleanTitle = title.replace(/&nbsp;/g, " ").trim();

  // Look for star patterns in the title (check longer patterns first)
  if (cleanTitle.includes("★★★★★")) return 5;
  if (cleanTitle.includes("★★★★½")) return 4.5;
  if (cleanTitle.includes("★★★★")) return 4;
  if (cleanTitle.includes("★★★½")) return 3.5;
  if (cleanTitle.includes("★★★")) return 3;
  if (cleanTitle.includes("★★½")) return 2.5;
  if (cleanTitle.includes("★★")) return 2;
  if (cleanTitle.includes("★½")) return 1.5;
  if (cleanTitle.includes("half-★")) return 0.5;
  if (cleanTitle.includes("★")) return 1;

  return 0;
};

const extractRatingCount = (title: string | undefined): number => {
  if (!title) return 0;
  const match = title.match(/^([\d,]+)/);
  if (!match || !match[1]) return 0;
  // Remove commas and parse as integer
  const numberStr = match[1].replace(/,/g, "");
  return parseInt(numberStr, 10) || 0;
};

export class ScraperController {
  private static browser: any | null = null;
  private static browserPromise: Promise<any> | null = null;

  // Get or create browser instance (reuse for performance)
  private static async getBrowser(): Promise<any> {
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    // Prevent multiple browser launches
    if (this.browserPromise) {
      return this.browserPromise;
    }

    this.browserPromise = this.createBrowser();
    this.browser = await this.browserPromise;
    this.browserPromise = null;

    return this.browser;
  }

  // Create new browser instance
  private static async createBrowser(): Promise<any> {
    let puppeteer: any = null,
      launchOptions: any = {
        headless: true,
      };
    if (process.env.VERCEL) {
      console.log(
        "is vercel/serverless, importing @sparticuz/chromium and puppeteer-core"
      );
      const chromium = (await import("@sparticuz/chromium")).default;
      puppeteer = (await import("puppeteer-core")).default;
      launchOptions = {
        ...launchOptions,
        args: [
          ...chromium.args,
          "--disable-dev-shm-usage", // Overcome limited resource problems
          "--disable-extensions", // Disable extensions
          "--disable-plugins", // Disable plugins
          "--disable-images", // Don't load images for faster page loads
          // Note: Don't disable JS/CSS as Letterboxd may need them for content rendering
          "--disable-web-security", // Disable web security
          "--no-sandbox", // Required for serverless
          "--disable-setuid-sandbox", // Required for serverless
          "--single-process", // Run in single process mode
          "--no-zygote", // Disable zygote process
          "--disable-background-timer-throttling", // Disable throttling
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-features=TranslateUI",
          "--disable-ipc-flooding-protection",
          "--max_old_space_size=4096", // Increase memory limit
          "--memory-pressure-off", // Disable memory pressure
          "--disable-background-networking", // Disable background networking
          "--disable-default-apps", // Disable default apps
          "--disable-sync", // Disable sync
          "--aggressive-cache-discard", // Aggressively discard cache to save memory
        ],
        executablePath: await chromium.executablePath(),
        defaultViewport: { width: 800, height: 600 }, // Minimal viewport for memory efficiency
        timeout: 30000, // Set launch timeout
      };
    } else {
      console.log("Not serverless, using full puppeteer for local development");
      try {
        // Use full puppeteer for local development (includes Chromium)
        puppeteer = (await import("puppeteer")).default;
      } catch (error) {
        console.log(
          "Full puppeteer not available, falling back to puppeteer-core with system Chrome"
        );
        puppeteer = (await import("puppeteer-core")).default;

        // Use optimized args from @sparticuz/chromium
        const chromium = (await import("@sparticuz/chromium")).default;
        launchOptions = {
          ...launchOptions,
          args: chromium.args,
          // Let puppeteer-core find system Chrome automatically
          // This will use the PUPPETEER_EXECUTABLE_PATH env var if set
        };
      }
    }

    console.log("Launching browser with options:", launchOptions);
    return await puppeteer.launch(launchOptions);
  }

  // returns browser page (now reuses browser instance)
  private static async createPage(): Promise<any> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    // Set a more realistic user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Set optimized viewport (smaller for production performance)
    await page.setViewport({
      width: process.env.VERCEL ? 1280 : 1920,
      height: process.env.VERCEL ? 720 : 1080,
    });

    // Enable request interception for performance optimization in production
    if (process.env.VERCEL) {
      await page.setRequestInterception(true);
      page.on("request", (request: any) => {
        const resourceType = request.resourceType();
        const url = request.url();

        // Block unnecessary resource types for faster loading (but keep CSS for content)
        if (
          ["image", "font", "media"].includes(resourceType) ||
          url.includes("google-analytics") ||
          url.includes("facebook.com") ||
          url.includes("twitter.com") ||
          url.includes("doubleclick") ||
          url.includes("ads") ||
          url.includes("analytics") ||
          url.includes("track")
        ) {
          request.abort();
        } else {
          request.continue();
        }
      });
    }

    // Set additional headers to look more like a real browser
    await page.setExtraHTTPHeaders({
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
    });

    // Performance optimizations - but be more selective to avoid detection
    await page.setRequestInterception(true);
    page.on("request", (req: any) => {
      // Only block images and fonts to avoid detection, allow CSS and scripts
      const resourceType = req.resourceType();
      if (["image", "font"].includes(resourceType)) {
        req.abort();
      } else {
        req.continue();
      }
    });

    // Additional stealth measures
    await page.evaluateOnNewDocument(() => {
      // Remove webdriver property
      Object.defineProperty(navigator, "webdriver", {
        get: () => undefined,
      });

      // Remove chrome property
      Object.defineProperty(navigator, "chrome", {
        get: () => undefined,
      });

      // Override permissions
      const originalQuery = window.navigator.permissions.query;
      window.navigator.permissions.query = (parameters) =>
        parameters.name === "notifications"
          ? Promise.resolve({ state: Notification.permission } as any)
          : originalQuery(parameters);
    });

    return page;
  }

  // Enhanced page creation for film scraping (no request interception to avoid conflicts)
  private static async createPageForFilmScraping(): Promise<any> {
    let puppeteer: any = null,
      launchOptions: any = {
        headless: true,
      };

    if (process.env.VERCEL) {
      console.log(
        "is vercel/serverless, importing @sparticuz/chromium and puppeteer-core for film scraping"
      );
      const chromium = (await import("@sparticuz/chromium")).default;
      puppeteer = (await import("puppeteer-core")).default;
      launchOptions = {
        ...launchOptions,
        args: [
          ...chromium.args,
          '--disable-dev-shm-usage',
          '--disable-extensions',
          '--disable-plugins',
          '--disable-images', // Block images for faster loading
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--single-process',
          '--no-zygote',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding',
          '--disable-features=TranslateUI',
          '--disable-ipc-flooding-protection',
          '--max_old_space_size=4096'
        ],
        executablePath: await chromium.executablePath(),
        defaultViewport: { width: 1280, height: 720 },
        timeout: 30000
      };
    } else {
      console.log("Not serverless, using full puppeteer for local development");
      try {
        puppeteer = (await import("puppeteer")).default;
      } catch (error) {
        console.log("Full puppeteer not available, falling back to puppeteer-core with system Chrome");
        puppeteer = (await import("puppeteer-core")).default;

        const chromium = (await import("@sparticuz/chromium")).default;
        launchOptions = {
          ...launchOptions,
          args: chromium.args,
        };
      }
    }

    const browser = await puppeteer.launch(launchOptions);
    const page = await browser.newPage();

    // Set a more realistic user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Set optimized viewport for film scraping
    await page.setViewport({
      width: process.env.VERCEL ? 1280 : 1920,
      height: process.env.VERCEL ? 720 : 1080
    });

    // NO REQUEST INTERCEPTION for film scraping to avoid "Request already handled" errors
    // This sacrifices some performance for reliability in long operations

    // Set additional headers
    await page.setExtraHTTPHeaders({
      "Accept-Language": "en-US,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    });

    // Store browser reference for cleanup
    (page as any)._browser = browser;

    return page;
  }

  // Enhanced page cleanup for film scraping
  private static async closePageAndBrowser(page: any): Promise<void> {
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
  }

  // scrapes data from url based on selectors
  private static async scrapePage(
    url: string,
    selectors: ScraperSelector[],
    watchForSelector?: string
  ): Promise<Record<string, any>[]> {
    const page = await ScraperController.createPage();

    try {
      // Navigate to the page with optimized waiting
      await page.goto(url, { waitUntil: "domcontentloaded" });

      if (watchForSelector) {
        await page.waitForSelector(watchForSelector, {
          timeout: 60000,
        });
      } else {
        // Wait for a short time to ensure content is loaded
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Convert utility function to string for passing to page.evaluate
      const parseRatingFnString =
        parseRatingFromTitle.toString().match(/{([\s\S]*)}$/)?.[1] || "";

      // Extract data using optimized page.evaluate()
      const collatedData = await page.evaluate(
        (selectorsData: ScraperSelector[], parseRatingFnStr: string) => {
          const results: Record<string, any>[] = [];

          // Use the passed utility function
          const parseRatingFromTitle = new Function(
            "title",
            parseRatingFnStr
          ) as (title: string | undefined) => number;

          // Helper function to extract data from an element
          const extractElementData = (
            element: Element,
            selector: ScraperSelector
          ): Record<string, any> => {
            const data: Record<string, any> = {};

            if (selector.attributes && Array.isArray(selector.attributes)) {
              // Extract attributes
              selector.attributes.forEach((attr) => {
                const value = element.getAttribute(attr);
                console.log(`Getting attribute ${attr}:`, value);
                if (value) {
                  data[attr] = value;
                }
              });
            } else {
              // Extract text content
              const text = element.textContent?.trim();
              if (text) {
                if (text.includes("★") || text.includes("☆")) {
                  data.rating = parseRatingFromTitle(text);
                } else {
                  data.text = text;
                }
              }
            }

            return data;
          };

          // Find the best parent container for grouping elements
          const findParentContainer = (): string | null => {
            // For our use case, we know we want to group by li.poster-container
            // since that's the common parent for all film data
            if (document.querySelector("li.poster-container")) {
              return "li.poster-container";
            }

            // Fallback to generic parent detection
            const commonParents = ["li", "div", "article", "section", "tr"];

            for (const parent of commonParents) {
              const parentElements = document.querySelectorAll(parent);
              if (parentElements.length > 0) {
                // Check if the first parent contains elements matching our selectors
                const firstParent = parentElements[0];
                if (firstParent) {
                  let hasMatchingElements = true;

                  for (const selector of selectorsData) {
                    if (!firstParent.querySelector(selector.css)) {
                      hasMatchingElements = false;
                      break;
                    }
                  }

                  if (hasMatchingElements) {
                    return parent;
                  }
                }
              }
            }
            return null;
          };

          const parentSelector = findParentContainer();
          console.log(`Using parent selector:`, parentSelector);

          if (parentSelector) {
            // Extract data using the selectors passed in
            const parentElements = document.querySelectorAll(parentSelector);
            console.log(`Found ${parentElements.length} parent elements`);

            parentElements.forEach((parentElement, index) => {
              const combinedRecord: Record<string, any> = {};
              console.log(`Processing parent element ${index}`);

              // Process each selector to extract data
              for (const selector of selectorsData) {
                console.log(`Processing selector:`, selector);

                // Find the element that matches this selector within the current parent
                let element;
                if (selector.css === parentSelector) {
                  // This selector targets the parent element itself
                  element = parentElement;
                } else {
                  // This selector targets a child element within the parent
                  // Find all elements matching this selector and check if they're within our parent
                  const allElements = document.querySelectorAll(selector.css);
                  for (let i = 0; i < allElements.length; i++) {
                    const el = allElements[i];
                    if (parentElement.contains(el as Node)) {
                      element = el;
                      break;
                    }
                  }
                }

                if (element) {
                  // Extract data according to the selector's configuration
                  const elementData = extractElementData(element, selector);
                  console.log(
                    `Extracted data for selector ${selector.css}:`,
                    elementData
                  );
                  Object.assign(combinedRecord, elementData);
                } else {
                  console.log(`No element found for selector:`, selector.css);
                }
              }

              // Extract rating from parent container if available
              const ratingElement = parentElement.querySelector(
                "p.poster-viewingdata > span.rating, .rating, [class*='rating']"
              );
              if (ratingElement) {
                const ratingText = ratingElement.textContent?.trim();
                if (
                  ratingText &&
                  (ratingText.includes("★") || ratingText.includes("☆"))
                ) {
                  combinedRecord.rating = parseRatingFromTitle(ratingText);
                  console.log(`Added rating:`, combinedRecord.rating);
                }
              }

              if (Object.keys(combinedRecord).length > 0) {
                console.log(`Final combined record:`, combinedRecord);
                console.log(
                  `Keys in combined record:`,
                  Object.keys(combinedRecord)
                );
                results.push(combinedRecord);
              } else {
                console.log(`No data extracted for this parent element`);
              }
            });
          } else {
            // Individual extraction - extract data for each selector separately
            for (const selector of selectorsData) {
              const elements = document.querySelectorAll(selector.css);

              elements.forEach((element) => {
                const elementData = extractElementData(element, selector);

                // For individual extraction, try to find the parent container to get additional data
                const parentContainer = element.closest("li.poster-container");
                if (parentContainer) {
                  // Extract rating
                  const ratingElement = parentContainer.querySelector(
                    "p.poster-viewingdata > span.rating, .rating, [class*='rating']"
                  );
                  if (ratingElement) {
                    const ratingText = ratingElement.textContent?.trim();
                    if (
                      ratingText &&
                      (ratingText.includes("★") || ratingText.includes("☆"))
                    ) {
                      elementData.rating = parseRatingFromTitle(ratingText);
                    }
                  }
                }

                if (Object.keys(elementData).length > 0) {
                  results.push(elementData);
                }
              });
            }
          }

          return results;
        },
        selectors,
        parseRatingFnString
      );

      return collatedData;
    } finally {
      await ScraperController.closePageAndBrowser(page);
    }
  }

  // Extract data from a page based on selectors
  static async extractData(
    url: string,
    selectors: ScraperSelector[]
  ): Promise<Record<string, any>[]> {
    const page = await ScraperController.createPage();
    console.log("in extractData");
    try {
      // Navigate to the page
      await page.goto(url, { waitUntil: "domcontentloaded" });
      console.log("navigated");
      // Wait a bit for content to load
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log("waited");

      // Extract data using page.evaluate
      console.log("About to evaluate page with selectors:", selectors);

      page.on("console", (consoleMessageObject: any) => {
        if (consoleMessageObject._type !== "warning") {
          console.debug(consoleMessageObject._text);
        }
      });
      const extractedData = await page.evaluate(
        (selectorsData: ScraperSelector[]) => {
          const results: Record<string, any>[] = [];

          // Get main content container
          const mainContent = document.querySelector("div#content.site-body");
          if (!mainContent) {
            console.log("Main content container not found");
            return [];
          }

          // Find all film containers first
          const filmContainers = mainContent.querySelectorAll(
            "li.poster-container"
          );
          console.log(`Found ${filmContainers.length} film containers`);

          // Process each film container
          filmContainers.forEach((container, index) => {
            const record: Record<string, any> = {};
            console.log(`Processing film container ${index}`);

            // Process each selector within this container
            selectorsData.forEach((selector) => {
              const elements = container.querySelectorAll(selector.css);
              console.log(
                `Found ${elements.length} elements for selector ${selector.css} in container ${index}`
              );

              if (elements.length > 0) {
                const element = elements[0]; // Take the first matching element

                if (element) {
                  if (selector.attributes && selector.attributes.length > 0) {
                    // Extract specified attributes
                    selector.attributes.forEach((attr) => {
                      const value = element.getAttribute(attr);
                      if (value) {
                        record[selector.name] = value;
                        console.log(
                          `Set ${selector.name} = ${value} for container ${index}`
                        );
                      }
                    });
                  } else {
                    // Extract text content when attributes array is empty
                    const text = element.textContent?.trim();
                    if (text) {
                      // Check if text contains star ratings and parse them
                      if (text.includes("★") || text.includes("☆")) {
                        // Simple rating parsing - count stars
                        const starCount = (text.match(/★/g) || []).length;
                        const halfStarCount = (text.match(/½/g) || []).length;
                        const rating = starCount + halfStarCount * 0.5;
                        record[selector.name] = rating;
                        console.log(
                          `Set ${selector.name} = ${rating} (parsed from: ${text}) for container ${index}`
                        );
                      } else {
                        record[selector.name] = text;
                        console.log(
                          `Set ${selector.name} = ${text} for container ${index}`
                        );
                      }
                    }
                  }
                }
              }
            });

            // Add this film's record if it has data
            if (Object.keys(record).length > 0) {
              results.push(record);
              console.log(`Added record for container ${index}:`, record);
            }
          });

          return results;
        },
        selectors
      );

      console.log("Page evaluation completed. Result:", extractedData);

      return extractedData;
    } finally {
      await ScraperController.closePageAndBrowser(page);
    }
  }

  static async cleanup(): Promise<void> {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  static async getData(req: Request, res: Response): Promise<void> {
    try {
      const { usernames, selectors } = req.body;

      if (!usernames || !Array.isArray(usernames) || usernames.length === 0) {
        const response: ApiResponse = {
          error: "Usernames array is required and must not be empty",
        };
        res.status(400).json(response);
        return;
      }

      if (!selectors || !Array.isArray(selectors)) {
        const response: ApiResponse = { error: "Selectors array is required" };
        res.status(400).json(response);
        return;
      }

      const results: Array<{
        username: string;
        data: any;
        success: boolean;
        error?: string;
      }> = [];

      // Iterate through each username
      for (const username of usernames) {
        try {
          // Construct the URL for the username
          const url = `https://letterboxd.com/${username}`;

          // Scrape the page data
          const scrapedData = await ScraperController.scrapePage(
            url,
            selectors,
            "section.ratings-histogram-chart"
          );

          results.push({
            username,
            data: scrapedData,
            success: true,
          });
        } catch (error) {
          console.error(`Error scraping data for username ${username}:`, error);
          results.push({
            username,
            data: null,
            success: false,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      const response: ApiResponse = {
        message: "Data fetched successfully",
        data: {
          results,
          timestamp: new Date().toISOString(),
        },
      };

      res.json(response);
    } catch (error) {
      console.error("Fetching error:", error);

      const response: ApiResponse = {
        error: `Failed to fetch data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
      res.status(500).json(response);
    }
  }

  // Database-first films endpoint with extended timeout handling
  static async getAllFilms(req: Request, res: Response): Promise<void> {
    const { username, forceRefresh = false } = req.body;

    if (!username) {
      res.status(400).json({ error: "Username is required" });
      return;
    }

    console.log(
      `Getting films for user: ${username}, forceRefresh: ${forceRefresh}`
    );

    // Set a longer timeout for this operation (10 minutes)
    const timeoutId = setTimeout(() => {
      if (!res.headersSent) {
        console.error(
          `Operation timed out for user ${username} after 10 minutes`
        );
        res.status(408).json({
          error: "Request timeout - film fetching took too long",
          message:
            "The operation exceeded the maximum allowed time. Please try again or contact support.",
        });
      }
    }, 10 * 60 * 1000); // 10 minutes

    try {
      // Step 1: Try to fetch from database first (unless force refresh)
      if (!forceRefresh) {
        const dbResult = await DataController.getUserFilms(username);

        if (dbResult.success && dbResult.data && dbResult.data.length > 0) {
          // Clear timeout and return cached data from database
          clearTimeout(timeoutId);
          res.json(
            ScraperController.formatFilmsResponse(
              username,
              dbResult.data,
              "User films retrieved from database",
              "database"
            )
          );
          return;
        }

        console.log(
          `No films in database for ${username}, proceeding to fetch`
        );
      } else {
        console.log(
          `Force refresh requested for ${username}, fetching fresh data`
        );
      }

      // Step 2: Scrape fresh data using common scraping method
      const scrapedFilms = await ScraperController.scrapeUserFilms(username);

      // Step 3: Save to database with upsert
      console.log(`Saving ${scrapedFilms.length} films to database...`);
      const saveResult = await DataController.upsertUserFilms(
        username,
        scrapedFilms
      );
      if (!saveResult.success) {
        console.warn(
          "Failed to save scraped films to database:",
          saveResult.error
        );
      } else {
        console.log(
          `Successfully saved ${scrapedFilms.length} films to database`
        );
      }

      // Step 4: Clear timeout and return scraped data using common response formatter
      clearTimeout(timeoutId);
      const source = forceRefresh
        ? "scraped_force_refresh"
        : "scraped_fallback";
      res.json(
        ScraperController.formatFilmsResponse(
          username,
          scrapedFilms,
          "User films fetched successfully",
          source
        )
      );
    } catch (error) {
      // Clear timeout on error as well
      clearTimeout(timeoutId);
      console.error("Error in getAllFilms:", error);

      if (!res.headersSent) {
        res.status(500).json({
          error: `Failed to get user films: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        });
      }
    }
  }

  // Common response formatter for film data - extracted for consistency
  private static formatFilmsResponse(
    username: string,
    films: UserFilm[],
    message: string,
    source: string
  ): object {
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
  }

  static async getUserRatings(req: Request, res: Response): Promise<void> {
    const { username } = req.body;

    if (!username) {
      res.status(400).json({ error: "Username is required" });
      return;
    }

    console.log(`Force fetching ratings for user: ${username}`);

    try {
      // Always scrape - this is the scraper endpoint
      const scrapedRatings = await ScraperController.scrapeUserRatings(
        username
      );
      await ScraperController.saveRatingsToDatabase(username, scrapedRatings);

      res.json({
        message: "User ratings scraped and stored successfully",
        data: {
          username,
          ratings: scrapedRatings,
          timestamp: new Date().toISOString(),
          source: "scraped",
          success: true,
        },
      });
    } catch (error) {
      console.error("Error in getUserRatings:", error);
      res.status(500).json({
        error: `Failed to fetch user ratings: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  static async scrapeUserRatings(
    username: string
  ): Promise<Array<{ rating: number; count: number }>> {
    console.log(`Fetching ratings for ${username} from Letterboxd...`);

    const page = await ScraperController.createPage();
    const url = `https://letterboxd.com/${username}`;

    try {
      await ScraperController.loadPageWithRetry(page, url);
      await ScraperController.waitForPageContent(page);

      const pageContent = await page.content();
      const $ = cheerio.load(pageContent);

      ScraperController.validateUserProfile($, username);
      const ratingsSection = ScraperController.findRatingsSection($);
      const ratings = ScraperController.extractRatingsData($, ratingsSection);

      if (ratings.length === 0) {
        throw new Error("No ratings data could be extracted from the page");
      }

      ratings.sort((a, b) => a.rating - b.rating);
      // console.log(`Extracted ${ratings.length} ratings:`, ratings);

      return ratings;
    } finally {
      await ScraperController.closePageAndBrowser(page);
    }
  }

  // Enhanced page loading with retry strategies - extended timeouts for film scraping
  private static async loadPageWithRetry(
    page: any,
    url: string,
    waitUntil: "networkidle2" | "domcontentloaded" | "load" = "networkidle2"
  ): Promise<void> {
    console.log(`Loading page: ${url}`);

    const strategies: Array<{
      waitUntil: "networkidle2" | "domcontentloaded" | "load";
      timeout: number;
    }> = [
      { waitUntil, timeout: 60000 },
      { waitUntil: "domcontentloaded", timeout: 45000 },
      { waitUntil: "load", timeout: 90000 },
    ];

    for (const [index, strategy] of strategies.entries()) {
      try {
        await page.goto(url, strategy);
        console.log(`Successfully loaded page with strategy ${index + 1}`);
        return;
      } catch (error) {
        console.warn(`Strategy ${index + 1} failed:`, error);
        if (index === strategies.length - 1) {
          throw new Error(
            `Failed to load page after ${strategies.length} attempts: ${error}`
          );
        }
      }
    }
  }

  private static async waitForPageContent(page: any): Promise<void> {
    await Promise.race([
      page.waitForSelector("body", { timeout: 30000 }),
      new Promise((resolve) => setTimeout(resolve, 10000)),
    ]);
  }

  private static validateUserProfile($: any, username: string): void {
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
      throw new Error(
        `Invalid page title indicates user not found: ${username}`
      );
    }

    // Check for basic page content
    const bodyText = $("body").text();
    if (!bodyText || bodyText.length < 100) {
      throw new Error(`Insufficient page content for user: ${username}`);
    }

    console.log(`Profile validation passed for user: ${username}`);
  }

  private static findRatingsSection($: any): any {
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
        // console.log(`Found ratings section with selector: ${selector}`);
        return section;
      }
    }

    throw new Error("No ratings section found on page");
  }

  private static extractRatingsData(
    $: any,
    ratingsSection: any
  ): Array<{ rating: number; count: number }> {
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
      const title = ScraperController.extractTitleFromElement($element);

      if (title) {
        const rating = parseRatingFromTitle(title);
        const count = extractRatingCount(title);

        if (rating > 0) {
          ratings.push({ rating, count });
          // console.log(
          //   `Extracted rating ${rating} with count ${count} from: ${title}`
          // );
        }
      }
    });

    return ratings;
  }

  private static extractTitleFromElement($element: any): string | null {
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
  }

  private static async saveRatingsToDatabase(
    username: string,
    ratings: Array<{ rating: number; count: number }>
  ): Promise<void> {
    const insertResult = await DataController.upsertUserRatings(
      username,
      ratings
    );

    if (!insertResult.success) {
      console.error("Database operation failed:", insertResult.error);
      throw new Error(
        `Failed to save ratings to database: ${insertResult.error}`
      );
    }

    console.log(
      `Successfully saved ${ratings.length} ratings for user ${username}`
    );
  }

  static async getUserProfile(req: Request, res: Response): Promise<void> {
    const { username } = req.body;

    if (!username) {
      res.status(400).json({ error: "Username is required" });
      return;
    }

    console.log(`Force scraping profile and ratings for user: ${username}`);

    try {
      // Always scrape both profile and ratings - this is the scraper endpoint
      const profileData = await ScraperController.scrapeUserProfileData(
        username
      );
      await ScraperController.saveProfileToDatabase(username, profileData);

      const ratingsData = await ScraperController.scrapeUserRatings(username);
      await ScraperController.saveRatingsToDatabase(username, ratingsData);

      // Calculate total ratings
      const totalRatings = ratingsData.reduce(
        (sum: number, rating: any) => sum + rating.count,
        0
      );

      const response = {
        username,
        displayName: profileData.displayName,
        followers: profileData.followers,
        following: profileData.following,
        numberOfLists: profileData.numberOfLists,
        totalRatings,
        ratings: ratingsData,
      };

      res.json({
        message: "User profile and ratings scraped successfully",
        data: response,
        source: "scraped",
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Error in getUserProfile:", error);
      res.status(500).json({
        error: `Failed to fetch user profile: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }

  static async scrapeUserProfileData(
    username: string
  ): Promise<UserProfileData> {
    console.log(`Fetching profile data for ${username} from Letterboxd...`);

    const page = await ScraperController.createPage();
    const url = `https://letterboxd.com/${username}`;

    try {
      await ScraperController.loadPageWithRetry(page, url);
      await ScraperController.waitForPageContent(page);

      const pageContent = await page.content();
      const $ = cheerio.load(pageContent);

      ScraperController.validateUserProfile($, username);

      // Extract followers count
      const followersElement = $(
        'a[href*="/followers/"] .value, a[href$="/followers/"] .value'
      );
      const followersText = followersElement.text().trim();
      const followers = ScraperController.parseNumberFromText(followersText);

      // Extract following count
      const followingElement = $(
        'a[href*="/following/"] .value, a[href$="/following/"] .value'
      );
      const followingText = followingElement.text().trim();
      const following = ScraperController.parseNumberFromText(followingText);

      // Extract number of lists
      const listsElement = $(
        'a[href*="/lists/"] .value, a[href$="/lists/"] .value'
      );
      const listsText = listsElement.text().trim();
      const numberOfLists = ScraperController.parseNumberFromText(listsText);

      // Extract display name from span with class "displayname"
      const displayNameElement = $("span.displayname");
      let displayName = displayNameElement.text().trim();

      // Fallback to username if no display name found
      if (!displayName) {
        displayName = username;
      }

      console.log(
        `Profile data extracted: displayName="${displayName}", followers=${followers}, following=${following}, numberOfLists=${numberOfLists}`
      );

      return {
        displayName,
        followers,
        following,
        numberOfLists,
      };
    } finally {
      await ScraperController.closePageAndBrowser(page);
    }
  }

  private static async saveProfileToDatabase(
    username: string,
    profileData: UserProfileData
  ): Promise<void> {
    try {
      console.log(
        `Saving profile data for ${username} to database:`,
        profileData
      );

      const result = await DataController.upsertUserProfile(
        username,
        profileData
      );

      if (!result.success) {
        console.error("Database operation failed:", result.error);
        throw new Error(`Failed to save profile to database: ${result.error}`);
      }

      console.log(`Successfully saved profile data for user ${username}`);
    } catch (error) {
      console.error("Error saving profile to database:", error);
      throw new Error(`Failed to save profile to database: ${error}`);
    }
  }

  private static parseNumberFromText(text: string): number {
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
  }

  // Common film scraping method - centralized logic with progress tracking
  private static async scrapeUserFilms(username: string): Promise<UserFilm[]> {
    const startTime = Date.now();
    console.log(
      `Starting film fetching for ${username} at ${new Date().toISOString()}`
    );

    const films: UserFilm[] = [];

    try {
      // Get first page to determine total pages
      console.log(`Fetching first page to determine total pages...`);
      const firstPageData = await ScraperController.scrapeFilmsPage(
        username,
        1
      );
      films.push(...firstPageData.films);

      console.log(`Found ${firstPageData.totalPages} total pages to fetch`);

      // Scrape remaining pages if any
      for (let page = 2; page <= firstPageData.totalPages; page++) {
        const pageStartTime = Date.now();
        console.log(
          `Scraping page ${page} of ${firstPageData.totalPages} for ${username} (${films.length} films collected so far)`
        );

        const pageData = await ScraperController.scrapeFilmsPage(
          username,
          page
        );
        films.push(...pageData.films);

        const pageTime = Date.now() - pageStartTime;
        console.log(
          `Page ${page} completed in ${pageTime}ms, collected ${pageData.films.length} films`
        );

        // Add delay between pages to be respectful (but reduce delay for faster completion)
        await new Promise((resolve) => setTimeout(resolve, 750));
      }

      const totalTime = Date.now() - startTime;
      console.log(
        `Completed fetching ${
          films.length
        } films for ${username} in ${totalTime}ms (${
          films.filter((f) => f.liked).length
        } liked)`
      );

      return films;
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error(
        `Film fetching failed for ${username} after ${totalTime}ms:`,
        error
      );
      throw error;
    }
  }

  // Common star rating parser - extracted for reuse
  private static parseStarRating(ratingText: string | undefined): number {
    if (!ratingText) return 0;

    const text = ratingText.trim();
    if (text.includes("★★★★★")) return 5;
    else if (text.includes("★★★★½")) return 4.5;
    else if (text.includes("★★★★")) return 4;
    else if (text.includes("★★★½")) return 3.5;
    else if (text.includes("★★★")) return 3;
    else if (text.includes("★★½")) return 2.5;
    else if (text.includes("★★")) return 2;
    else if (text.includes("★½")) return 1.5;
    else if (text.includes("★")) return 1;
    else if (text.includes("½")) return 0.5;
    return 0;
  }

  // Common liked detection logic - extracted for reuse
  private static detectLikedStatus(container: Element, index: number): boolean {
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
  }

  // Refactored film page scraping - uses extracted common logic
  private static async scrapeFilmsPage(
    username: string,
    pageNum: number
  ): Promise<{
    films: UserFilm[];
    totalPages: number;
  }> {
    const page = await ScraperController.createPageForFilmScraping();

    try {
      const url = ScraperController.buildFilmsPageUrl(username, pageNum);
      await ScraperController.loadPageWithRetry(page, url);

      // Get pagination info (only on first page)
      let totalPages = 1;
      if (pageNum === 1) {
        totalPages = await ScraperController.extractTotalPages(page, username);
      }

      // Extract film data using common parsing logic
      const filmsData = await ScraperController.extractFilmsFromPage(page);

      console.log(
        `Fetched ${filmsData.length} films from page ${pageNum}, ${
          filmsData.filter((f) => f.liked).length
        } liked`
      );

      return { films: filmsData, totalPages };
    } finally {
      await ScraperController.closePageAndBrowser(page);
    }
  }

  // Extracted URL building logic for consistency
  private static buildFilmsPageUrl(username: string, pageNum: number): string {
    return pageNum === 1
      ? `https://letterboxd.com/${username}/films`
      : `https://letterboxd.com/${username}/films/page/${pageNum}`;
  }

  // Extracted film data extraction logic for reuse
  private static async extractFilmsFromPage(page: any): Promise<UserFilm[]> {
    return await page.evaluate(
      (parseStarRatingStr: string, detectLikedStatusStr: string) => {
        // Recreate the utility functions in page context
        const parseStarRating = new Function(
          "ratingText",
          parseStarRatingStr
        ) as (ratingText: string | undefined) => number;
        const detectLikedStatus = new Function(
          "container",
          "index",
          detectLikedStatusStr
        ) as (container: Element, index: number) => boolean;

        const films: UserFilm[] = [];

        const filmContainers = document.querySelectorAll("li.griditem");
        console.log(`Found ${filmContainers.length} film containers on page`);

        filmContainers.forEach((container, index) => {
          const filmDiv = container.querySelector("div[data-item-slug]");
          const filmSlug = filmDiv?.getAttribute("data-item-slug");
          const filmTitle = filmDiv?.getAttribute("data-item-name");

          if (filmSlug && filmTitle) {
            // Extract user rating using common logic
            const ratingElement = container.querySelector(
              "p.poster-viewingdata span.rating"
            );
            const ratingText = ratingElement?.textContent?.trim();
            const rating = parseStarRating(ratingText);

            // Extract liked status using common logic
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
      // Pass the function bodies as strings to be recreated in page context
      ScraperController.parseStarRating.toString().match(/{([\s\S]*)}$/)?.[1] ||
        "",
      ScraperController.detectLikedStatus
        .toString()
        .match(/{([\s\S]*)}$/)?.[1] || ""
    );
  }

  // Extracted pagination logic for reuse
  private static async extractTotalPages(
    page: any,
    username: string
  ): Promise<number> {
    try {
      await page.waitForSelector("div.paginate-pages", { timeout: 10000 });
      const numberOfPages = await page.$eval(
        "div.paginate-pages > ul > li:last-child > a",
        (element: Element) => element.textContent
      );
      const totalPages = Number(numberOfPages) || 1;
      console.log(`Found ${totalPages} total pages for ${username}`);
      return totalPages;
    } catch (error) {
      console.log("No pagination found, treating as single page");
      return 1;
    }
  }

  // Progress-enabled version of scrapeUserFilms for SSE streaming with browser reuse optimization
  private static async scrapeUserFilmsWithProgress(
    username: string,
    progressEmitter: EventEmitter
  ): Promise<UserFilm[]> {
    const startTime = Date.now();
    progressEmitter.emit("progress", {
      type: "init",
      message: `Starting film fetching for ${username}`,
      timestamp: new Date().toISOString(),
    });

    const films: UserFilm[] = [];
    let sharedBrowser: any = null;

    try {
      // Create a single browser instance for memory efficiency
      progressEmitter.emit('progress', {
        type: 'browser_launch',
        message: 'Launching browser for film scraping session...',
        timestamp: new Date().toISOString()
      });

      sharedBrowser = await ScraperController.createBrowser();

      // Get first page to determine total pages
      progressEmitter.emit('progress', {
        type: 'fetching_first_page',
        message: 'Fetching first page to determine total pages...',
        timestamp: new Date().toISOString()
      });

      const firstPageData = await ScraperController.scrapeFilmsPageWithMemoryCleanup(
        username,
        1,
        sharedBrowser,
        progressEmitter
      );
      films.push(...firstPageData.films);

      progressEmitter.emit('progress', {
        type: 'pages_found',
        message: `Found ${firstPageData.totalPages} total pages to scrape`,
        totalPages: firstPageData.totalPages,
        filmsFromFirstPage: firstPageData.films.length,
        timestamp: new Date().toISOString()
      });

      // Scrape remaining pages with fresh pages and aggressive cleanup
      for (let page = 2; page <= firstPageData.totalPages; page++) {
        progressEmitter.emit('progress', {
          type: 'page_start',
          message: `Scraping page ${page} of ${firstPageData.totalPages}`,
          currentPage: page,
          totalPages: firstPageData.totalPages,
          filmsCollectedSoFar: films.length,
          timestamp: new Date().toISOString()
        });

        const pageData = await ScraperController.scrapeFilmsPageWithMemoryCleanup(
          username,
          page,
          sharedBrowser,
          progressEmitter
        );

        films.push(...pageData.films);

        progressEmitter.emit('progress', {
          type: 'page_complete',
          message: `Completed page ${page} of ${firstPageData.totalPages}`,
          currentPage: page,
          totalPages: firstPageData.totalPages,
          filmsFromThisPage: pageData.films.length,
          filmsCollectedSoFar: films.length,
          timestamp: new Date().toISOString()
        });

        // Memory cleanup delay
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Force garbage collection every 5 pages
        if (page % 5 === 0 && global.gc) {
          global.gc();
          progressEmitter.emit('progress', {
            type: 'memory_cleanup',
            message: `Memory cleanup after page ${page}`,
            timestamp: new Date().toISOString()
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
      // Clean up the shared browser
      if (sharedBrowser) {
        try {
          await sharedBrowser.close();
          progressEmitter.emit('progress', {
            type: 'cleanup',
            message: 'Browser cleanup completed',
            timestamp: new Date().toISOString()
          });
        } catch (cleanupError) {
          console.error("Browser cleanup error:", cleanupError);
        }
      }
    }
  }


  // Memory-efficient page scraping that creates fresh pages and cleans up aggressively
  private static async scrapeFilmsPageWithMemoryCleanup(
    username: string,
    pageNum: number,
    browser: any,
    progressEmitter: EventEmitter
  ): Promise<{ films: UserFilm[]; totalPages: number }> {
    let page: any = null;

    try {
      // Create fresh page for this request to avoid memory buildup
      page = await browser.newPage();

      // Remove aggressive timeouts to allow for longer operations

      // Block unnecessary resources to save memory
      await page.setRequestInterception(true);
      page.on('request', (req: any) => {
        const resourceType = req.resourceType();
        if (['image', 'stylesheet', 'font', 'media'].includes(resourceType)) {
          req.abort();
        } else {
          req.continue();
        }
      });

      const url = ScraperController.buildFilmsPageUrl(username, pageNum);

      // Load page with retry
      await ScraperController.loadPageWithRetry(
        page,
        url,
        "domcontentloaded"
      );

      // Get pagination info (only on first page)
      let totalPages = 1;
      if (pageNum === 1) {
        totalPages = await ScraperController.extractTotalPages(page, username);
      }

      // Extract films from current page
      const films = await ScraperController.extractFilmsFromPage(page);

      progressEmitter.emit('progress', {
        type: 'page_extracted',
        message: `Extracted ${films.length} films from page ${pageNum}`,
        currentPage: pageNum,
        filmsFromPage: films.length,
        timestamp: new Date().toISOString()
      });

      return { films, totalPages };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      progressEmitter.emit('progress', {
        type: 'page_error',
        message: `Error on page ${pageNum}: ${errorMessage}`,
        currentPage: pageNum,
        error: errorMessage,
        timestamp: new Date().toISOString()
      });
      throw error;
    } finally {
      // Aggressive cleanup - close page immediately
      if (page) {
        try {
          await page.close();
        } catch (cleanupError) {
          console.error(`Page cleanup error for page ${pageNum}:`, cleanupError);
        }
      }
    }
  }

  // SSE endpoint for streaming film scraping progress
  static async fetchFilms(req: Request, res: Response): Promise<void> {
    const { username } = req.params;

    if (!username) {
      res.status(400).json({ error: "Username is required" });
      return;
    }

    console.log(`Starting SSE stream for film fetching: ${username}`);

    // Set up SSE headers
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Cache-Control",
    });

    // Create event emitter for progress updates
    const progressEmitter = new EventEmitter();
    let isCompleted = false;
    let heartbeatInterval: NodeJS.Timeout;

    // Set up progress listeners
    progressEmitter.on("progress", (data) => {
      if (!res.headersSent || !res.writable) return;
      try {
        res.write(`data: ${JSON.stringify(data)}\n\n`);
      } catch (writeError) {
        console.error("Error writing SSE data:", writeError);
      }
    });

    progressEmitter.on("error", (error) => {
      if (!res.headersSent || !res.writable || isCompleted) return;
      try {
        res.write(
          `data: ${JSON.stringify({
            type: "error",
            message: error.message,
            timestamp: new Date().toISOString(),
          })}\n\n`
        );
        cleanup();
      } catch (writeError) {
        console.error("Error writing SSE error:", writeError);
      }
    });

    progressEmitter.on("complete", (data) => {
      if (!res.headersSent || !res.writable || isCompleted) return;
      try {
        res.write(
          `data: ${JSON.stringify({
            type: "complete",
            data,
            timestamp: new Date().toISOString(),
          })}\n\n`
        );
        cleanup();
      } catch (writeError) {
        console.error("Error writing SSE completion:", writeError);
      }
    });

    // Cleanup function
    const cleanup = () => {
      if (isCompleted) return;
      isCompleted = true;

      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }

      progressEmitter.removeAllListeners();

      if (!res.headersSent && res.writable) {
        try {
          res.end();
        } catch (endError) {
          console.error("Error ending SSE response:", endError);
        }
      }
    };

    // Handle client disconnect
    req.on("close", () => {
      console.log(`SSE connection closed for ${username}`);
      cleanup();
    });

    // Handle process termination (cleanup browser on exit)
    process.on("exit", () => {
      // Browser cleanup handled elsewhere
    });

    // Production timeout protection (8 minutes for Vercel limit)
    const productionTimeout = setTimeout(() => {
      console.log(`Production timeout reached for ${username}`);
      progressEmitter.emit("error", {
        message:
          "Operation timeout - the scraping process is taking too long. Please try again later or contact support.",
        code: "PRODUCTION_TIMEOUT",
      });
    }, 8 * 60 * 1000); // 8 minutes

    // Heartbeat to keep connection alive
    heartbeatInterval = setInterval(() => {
      if (!res.headersSent || !res.writable || isCompleted) return;
      try {
        res.write(
          `data: ${JSON.stringify({
            type: "heartbeat",
            timestamp: new Date().toISOString(),
          })}\n\n`
        );
      } catch (writeError) {
        console.error("Error writing heartbeat:", writeError);
        cleanup();
      }
    }, 30000); // Every 30 seconds

    try {
      // Send initial status
      progressEmitter.emit("progress", {
        type: "start",
        message: `Starting film fetching for ${username}`,
        timestamp: new Date().toISOString(),
      });

      // Start the film scraping with progress updates and timeout handling
      const films =
        await ScraperController.scrapeUserFilmsWithProgress(
          username,
          progressEmitter
        );

      if (isCompleted) return; // Check if already completed/errored

      // Save to database
      progressEmitter.emit("progress", {
        type: "saving",
        message: "Saving films to database...",
        timestamp: new Date().toISOString(),
      });

      await DataController.upsertUserFilms(username, films);

      if (isCompleted) return; // Check again after database operation

      // Send completion
      clearTimeout(productionTimeout);
      progressEmitter.emit("complete", {
        username,
        totalFilms: films.length,
        films,
        source: "scraped",
        message: `Successfully fetched ${films.length} films for ${username}`,
      });
    } catch (error) {
      console.error(`Error in fetchFilms for ${username}:`, error);
      clearTimeout(productionTimeout);

      if (!isCompleted) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error occurred";

        // Handle specific timeout errors
        if (
          errorMessage.includes("Navigation timeout") ||
          errorMessage.includes("TimeoutError")
        ) {
          progressEmitter.emit("error", {
            message:
              "Page loading timeout - the Letterboxd page is taking too long to load. Please try again later.",
            code: "NAVIGATION_TIMEOUT",
            username,
          });
        } else {
          progressEmitter.emit("error", {
            message: errorMessage,
            username,
          });
        }
      }
    }
  }
}
