/// <reference lib="dom" />
import { Request, Response } from "express";
import { EventEmitter } from "events";

import { ApiResponse, ScraperSelector } from "../types";
import { getUserFilms, upsertUserFilms } from "./dataController";
import { BROWSER_CONFIG } from "../constants";
import { formatFilmsResponse, delay } from "../utilities";
import {
  createPage,
  closePageAndBrowser,
  cleanup,
  scrapeUserRatings,
  saveRatingsToDatabase,
  scrapeUserProfileData,
  saveProfileToDatabase,
  scrapeUserFilms,
  scrapeUserFilmsWithProgress,
} from "../scraperFunctions";

/**
 * Scrape page data based on selectors
 */
export const scrapePage = async (
  url: string,
  selectors: ScraperSelector[],
  watchForSelector?: string
): Promise<Record<string, any>[]> => {
  const page = await createPage();

  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });

    if (watchForSelector) {
      await page.waitForSelector(watchForSelector, {
        timeout: BROWSER_CONFIG.PAGE_LOAD_TIMEOUT,
      });
    } else {
      await delay(BROWSER_CONFIG.PAGE_DELAY);
    }

    const collatedData = await page.evaluate(
      (selectorsData: ScraperSelector[]) => {
        const results: Record<string, any>[] = [];

        // Inline parseRatingFromTitle for efficiency
        const parseRatingFromTitle = (title: string | undefined): number => {
          if (!title) return 0;
          const starCount = (title.match(/★/g) || []).length;
          const halfStarCount = (title.match(/½/g) || []).length;
          return starCount + halfStarCount * 0.5;
        };

        const extractElementData = (
          element: Element,
          selector: ScraperSelector
        ): Record<string, any> => {
          const data: Record<string, any> = {};

          if (selector.attributes && Array.isArray(selector.attributes)) {
            selector.attributes.forEach((attr) => {
              const value = element.getAttribute(attr);
              // console.log(`Getting attribute ${attr}:`, value);
              if (value) {
                data[attr] = value;
              }
            });
          } else {
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

        // Cache parent selector lookup
        let cachedParentSelector: string | null | undefined = undefined;
        const findParentContainer = (): string | null => {
          if (cachedParentSelector !== undefined) {
            return cachedParentSelector;
          }

          if (document.querySelector("li.poster-container")) {
            cachedParentSelector = "li.poster-container";
            return cachedParentSelector;
          }

          const commonParents = ["li", "div", "article", "section", "tr"];

          for (const parent of commonParents) {
            const parentElements = document.querySelectorAll(parent);
            if (parentElements.length > 0) {
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
                  cachedParentSelector = parent;
                  return cachedParentSelector;
                }
              }
            }
          }
          cachedParentSelector = null;
          return cachedParentSelector;
        };

        const parentSelector = findParentContainer();
        // console.log(`Using parent selector:`, parentSelector);

        if (parentSelector) {
          const parentElements = document.querySelectorAll(parentSelector);
          // console.log(`Found ${parentElements.length} parent elements`);

          parentElements.forEach((parentElement) => {
            const combinedRecord: Record<string, any> = {};
            // console.log(`Processing parent element ${index}`);

            for (const selector of selectorsData) {
              // console.log(`Processing selector:`, selector);

              let element;
              if (selector.css === parentSelector) {
                element = parentElement;
              } else {
                // Optimize: Query within parent element instead of globally
                element = parentElement.querySelector(selector.css);
              }

              if (element) {
                const elementData = extractElementData(element, selector);
                // console.log(
                //   `Extracted data for selector ${selector.css}:`,
                //   elementData
                // );
                Object.assign(combinedRecord, elementData);
              } // else {
                // console.log(`No element found for selector:`, selector.css);
              // }
            }

            // Remove duplicate rating extraction - already handled in extractElementData
            if (Object.keys(combinedRecord).length > 0) {
              // console.log(`Final combined record:`, combinedRecord);
              // console.log(
              //   `Keys in combined record:`,
              //   Object.keys(combinedRecord)
              // );
              results.push(combinedRecord);
            } // else {
              // console.log(`No data extracted for this parent element`);
            // }
          });
        } else {
          for (const selector of selectorsData) {
            const elements = document.querySelectorAll(selector.css);

            elements.forEach((element) => {
              const elementData = extractElementData(element, selector);

              // Remove duplicate rating extraction - already handled in extractElementData
              if (Object.keys(elementData).length > 0) {
                results.push(elementData);
              }
            });
          }
        }

        return results;
      },
      selectors
    );

    return collatedData;
  } finally {
    await closePageAndBrowser(page);
  }
};

/**
 * Extract data from page based on selectors
 */
export const extractData = async (
  url: string,
  selectors: ScraperSelector[]
): Promise<Record<string, any>[]> => {
  const page = await createPage();
  console.log("in extractData");
  try {
    await page.goto(url, { waitUntil: "domcontentloaded" });
    console.log("navigated");
    await delay(BROWSER_CONFIG.PAGE_DELAY);
    console.log("waited");

    console.log("About to evaluate page with selectors:", selectors);

    page.on("console", (consoleMessageObject: any) => {
      if (consoleMessageObject._type !== "warning") {
        console.debug(consoleMessageObject._text);
      }
    });

    const extractedData = await page.evaluate(
      (selectorsData: ScraperSelector[]) => {
        const results: Record<string, any>[] = [];

        const mainContent = document.querySelector("div#content.site-body");
        if (!mainContent) {
          console.log("Main content container not found");
          return [];
        }

        const filmContainers = mainContent.querySelectorAll(
          "li.poster-container"
        );
        console.log(`Found ${filmContainers.length} film containers`);

        filmContainers.forEach((container, index) => {
          const record: Record<string, any> = {};
          console.log(`Processing film container ${index}`);

          selectorsData.forEach((selector) => {
            const elements = container.querySelectorAll(selector.css);
            console.log(
              `Found ${elements.length} elements for selector ${selector.css} in container ${index}`
            );

            if (elements.length > 0) {
              const element = elements[0];

              if (element) {
                if (selector.attributes && selector.attributes.length > 0) {
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
                  const text = element.textContent?.trim();
                  if (text) {
                    if (text.includes("★") || text.includes("☆")) {
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
    await closePageAndBrowser(page);
  }
};

/**
 * Generic data extraction endpoint
 */
export const getData = async (req: Request, res: Response): Promise<void> => {
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

    for (const username of usernames) {
      try {
        const url = `https://letterboxd.com/${username}`;
        const scrapedData = await scrapePage(
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
};

/**
 * Core film scraping logic (shared between getAllFilms and fetchFilms)
 * @param username - Letterboxd username
 * @param forceRefresh - Skip database check and force scraping
 * @param progressEmitter - Optional EventEmitter for SSE progress updates
 * @returns Object with films data and metadata
 */
async function scrapeAndSaveFilms(
  username: string,
  forceRefresh: boolean = false,
  progressEmitter?: EventEmitter
): Promise<{
  films: any[];
  source: string;
  fromDatabase: boolean;
}> {
  // Try database first (unless force refresh)
  if (!forceRefresh) {
    const dbResult = await getUserFilms(username);

    if (dbResult.success && dbResult.data && dbResult.data.length > 0) {
      console.log(`Returning ${dbResult.data.length} films from database for ${username}`);
      return {
        films: dbResult.data,
        source: "database",
        fromDatabase: true,
      };
    }

    console.log(`No films in database for ${username}, proceeding to scrape`);
  } else {
    console.log(`Force refresh requested for ${username}, scraping fresh data`);
  }

  // Scrape films (with or without progress reporting)
  const scrapedFilms = progressEmitter
    ? await scrapeUserFilmsWithProgress(username, progressEmitter)
    : await scrapeUserFilms(username);

  // Save films to database
  if (progressEmitter) {
    progressEmitter.emit("progress", {
      type: "saving",
      message: "Saving films to database...",
      timestamp: new Date().toISOString(),
    });
  } else {
    console.log(`Saving ${scrapedFilms.length} films to database...`);
  }

  const saveResult = await upsertUserFilms(username, scrapedFilms);
  if (!saveResult.success) {
    console.warn("Failed to save scraped films to database:", saveResult.error);
  } else {
    console.log(`Successfully saved ${scrapedFilms.length} films to database`);
  }

  // Also scrape and save ratings
  if (progressEmitter) {
    progressEmitter.emit("progress", {
      type: "scraping_ratings",
      message: "Scraping user ratings...",
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const scrapedRatings = await scrapeUserRatings(username);

    if (progressEmitter) {
      progressEmitter.emit("progress", {
        type: "saving_ratings",
        message: "Saving ratings to database...",
        timestamp: new Date().toISOString(),
      });
    }

    await saveRatingsToDatabase(username, scrapedRatings);

    if (progressEmitter) {
      progressEmitter.emit("progress", {
        type: "ratings_complete",
        message: `Updated ${scrapedRatings.length} rating categories`,
        ratingsCount: scrapedRatings.length,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (ratingsError) {
    console.warn("Failed to update ratings:", ratingsError);
    if (progressEmitter) {
      progressEmitter.emit("progress", {
        type: "ratings_warning",
        message: "Warning: Could not update ratings data",
        timestamp: new Date().toISOString(),
      });
    }
  }

  const source = forceRefresh ? "scraped_force_refresh" : "scraped_fallback";
  return {
    films: scrapedFilms,
    source,
    fromDatabase: false,
  };
}

/**
 * Get all films for a user (database-first with scraping fallback)
 * Returns JSON response (non-streaming)
 */
export const getAllFilms = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { username, forceRefresh = false } = req.body;

  if (!username) {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  console.log(
    `Getting films for user: ${username}, forceRefresh: ${forceRefresh}`
  );

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
  }, BROWSER_CONFIG.LONG_OPERATION_TIMEOUT);

  try {
    const result = await scrapeAndSaveFilms(username, forceRefresh);

    clearTimeout(timeoutId);
    res.json(
      formatFilmsResponse(
        username,
        result.films,
        result.fromDatabase
          ? "User films retrieved from database"
          : "User films fetched successfully",
        result.source
      )
    );
  } catch (error) {
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
};

/**
 * Get user ratings (force scraping)
 */
export const getUserRatings = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { username } = req.body;

  if (!username) {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  console.log(`Force fetching ratings for user: ${username}`);

  try {
    const scrapedRatings = await scrapeUserRatings(username);
    await saveRatingsToDatabase(username, scrapedRatings);

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
};

/**
 * Get user profile (force scraping)
 */
export const getUserProfile = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { username } = req.body;

  if (!username) {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  console.log(`Force scraping profile and ratings for user: ${username}`);

  try {
    const profileData = await scrapeUserProfileData(username);
    await saveProfileToDatabase(username, profileData);

    const ratingsData = await scrapeUserRatings(username);
    await saveRatingsToDatabase(username, ratingsData);

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
};

/**
 * SSE endpoint for streaming film scraping progress
 */
export const fetchFilms = async (
  req: Request,
  res: Response
): Promise<void> => {
  const { username } = req.params;

  if (!username) {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  console.log(`Starting SSE stream for film fetching: ${username}`);

  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });

  const progressEmitter = new EventEmitter();
  let isCompleted = false;
  let heartbeatInterval: NodeJS.Timeout;

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
      cleanupFn();
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
      cleanupFn();
    } catch (writeError) {
      console.error("Error writing SSE completion:", writeError);
    }
  });

  const cleanupFn = () => {
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

  req.on("close", () => {
    console.log(`SSE connection closed for ${username}`);
    cleanupFn();
  });

  process.on("exit", () => {
    // Browser cleanup handled elsewhere
  });

  const productionTimeout = setTimeout(() => {
    console.log(`Production timeout reached for ${username}`);
    progressEmitter.emit("error", {
      message:
        "Operation timeout - the scraping process is taking too long. Please try again later or contact support.",
      code: "PRODUCTION_TIMEOUT",
    });
  }, BROWSER_CONFIG.PRODUCTION_TIMEOUT);

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
      cleanupFn();
    }
  }, BROWSER_CONFIG.SSE_HEARTBEAT_INTERVAL);

  try {
    progressEmitter.emit("progress", {
      type: "start",
      message: `Starting film fetching for ${username}`,
      timestamp: new Date().toISOString(),
    });

    // Use shared scraping logic with progress reporting
    const result = await scrapeAndSaveFilms(username, true, progressEmitter);

    if (isCompleted) return;

    clearTimeout(productionTimeout);
    progressEmitter.emit("complete", {
      username,
      totalFilms: result.films.length,
      films: result.films,
      source: result.source,
      message: `Successfully fetched ${result.films.length} films for ${username}`,
    });
  } catch (error) {
    console.error(`Error in fetchFilms for ${username}:`, error);
    clearTimeout(productionTimeout);

    if (!isCompleted) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

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
};

// Export cleanup for module management
export { cleanup };
