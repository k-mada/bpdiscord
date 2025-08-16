/// <reference lib="dom" />
import { Request, Response } from "express";
import puppeteer, { Browser, Page } from "puppeteer";
import * as cheerio from "cheerio";
import { ApiResponse, ScraperSelector } from "../types";
import { DataController } from "./dataController";

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
  private static browser: Browser | null = null;

  // initializes puppeteer browser
  private static async initializeBrowser(): Promise<Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
          "--disable-web-security",
          "--disable-features=VizDisplayCompositor",
          "--disable-background-timer-throttling",
          "--disable-backgrounding-occluded-windows",
          "--disable-renderer-backgrounding",
          "--disable-ipc-flooding-protection",
          "--memory-pressure-off",
          "--disable-extensions",
          "--disable-plugins",
          "--disable-default-apps",
          "--disable-sync",
          "--disable-translate",
          "--disable-background-networking",
          "--metrics-recording-only",
          "--no-default-browser-check",
          "--safebrowsing-disable-auto-update",
        ],
      });
    }
    return this.browser;
  }

  // returns browser page
  private static async createPage(): Promise<Page> {
    const browser = await this.initializeBrowser();
    const page = await browser.newPage();

    // Set a more realistic user agent
    await page.setUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    );

    // Set realistic viewport
    await page.setViewport({ width: 1920, height: 1080 });

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
    page.on("request", (req) => {
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
          timeout: 10000,
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
      await page.close();
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
        console.log("consoleMessageObject", consoleMessageObject);
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
      await page.close();
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
        message: "Data scraped successfully",
        data: {
          results,
          timestamp: new Date().toISOString(),
        },
      };

      res.json(response);
    } catch (error) {
      console.error("Scraping error:", error);

      const response: ApiResponse = {
        error: `Failed to scrape data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
      res.status(500).json(response);
    }
  }

  static async getAllFilms(req: Request, res: Response): Promise<void> {
    let page: Page | null = null;

    try {
      const { username } = req.body;
      console.log("username", username);

      if (!username) {
        const response: ApiResponse = { error: "Username is required" };
        res.status(400).json(response);
        return;
      }

      // Use the refactored browser infrastructure
      page = await ScraperController.createPage();

      // Navigate to the user's Letterboxd page
      const url = `https://letterboxd.com/${username}/films`;
      await page.goto(url, { waitUntil: "networkidle2" });

      // Try to get pagination info
      let pageCount = 1; // Default to 1 page

      try {
        await page.waitForSelector("div.paginate-pages", { timeout: 3000 });
        const numberOfPages = await page.$eval(
          "div.paginate-pages > ul > li:last-child > a",
          (element: Element) => element.innerText
        );
        pageCount = Number(numberOfPages) || 1;
      } catch (error) {
        console.log("No pagination found, treating as single page");
      }

      let filmData: any[] = [];

      // TODO: PUT BACK pageCount IN LOOP
      for (let i = 1; i <= 2; i++) {
        try {
          const pageUrl =
            i === 1
              ? `https://letterboxd.com/${username}/films`
              : `https://letterboxd.com/${username}/films/page/${i}`;
          console.log("fetching data");
          const film = await ScraperController.extractData(pageUrl, [
            {
              name: "film-name",
              css: "li.poster-container > div",
              attributes: ["data-film-name"],
              multiple: true,
            },
            {
              name: "film-slug",
              css: "li.poster-container > div",
              attributes: ["data-film-slug"],
              multiple: true,
            },
            {
              name: "film-rating",
              css: "li.poster-container > p.poster-viewingdata > span.rating",
              attributes: [],
              multiple: true,
            },
          ]);
          console.log(`Got ${film.length} films for page ${i}`);
          filmData.push(...film);
        } catch (error) {
          console.error(`Error scraping page ${i}:`, error);
        }
      }

      const response: ApiResponse = {
        message: "Films scraped successfully",
        data: {
          username,
          filmData,
          totalPages: pageCount,
          totalFilms: filmData.length,
        },
      };
      res.json(response);
    } catch (error) {
      console.error("Error in getAllFilms:", error);
      const response: ApiResponse = {
        error: `Failed to scrape films: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
      res.status(500).json(response);
    } finally {
      // Clean up the page
      if (page) {
        try {
          await page.close();
        } catch (error) {
          console.error("Error closing page:", error);
        }
      }
    }
  }

  static async getUserRatings(req: Request, res: Response): Promise<void> {
    const { username } = req.body;

    if (!username) {
      res.status(400).json({ error: "Username is required" });
      return;
    }

    console.log(`Force scraping ratings for user: ${username}`);

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
        error: `Failed to scrape user ratings: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }


  static async scrapeUserRatings(
    username: string
  ): Promise<Array<{ rating: number; count: number }>> {
    console.log(`Scraping ratings for ${username} from Letterboxd...`);

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
      await page.close();
    }
  }

  private static async loadPageWithRetry(
    page: Page,
    url: string
  ): Promise<void> {
    console.log(`Loading page: ${url}`);

    const strategies: Array<{
      waitUntil: "networkidle2" | "domcontentloaded" | "load";
      timeout: number;
    }> = [
      { waitUntil: "networkidle2", timeout: 30000 },
      { waitUntil: "domcontentloaded", timeout: 30000 },
      { waitUntil: "load", timeout: 45000 },
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

  private static async waitForPageContent(page: Page): Promise<void> {
    await Promise.race([
      page.waitForSelector("body", { timeout: 10000 }),
      new Promise((resolve) => setTimeout(resolve, 5000)),
    ]);
  }

  private static validateUserProfile($: cheerio.Root, username: string): void {
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

  private static findRatingsSection($: cheerio.Root): cheerio.Cheerio {
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
    $: cheerio.Root,
    ratingsSection: cheerio.Cheerio
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

    let ratingBars: cheerio.Cheerio | null = null;

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

    ratingBars.each((index: number, element: cheerio.Element) => {
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

  private static extractTitleFromElement(
    $element: cheerio.Cheerio
  ): string | null {
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
      const profileData = await ScraperController.scrapeUserProfileData(username);
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
        error: `Failed to scrape user profile: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
  }


  static async scrapeUserProfileData(
    username: string
  ): Promise<UserProfileData> {
    console.log(`Scraping profile data for ${username} from Letterboxd...`);

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
      await page.close();
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
}
