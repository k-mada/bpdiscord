import { Request, Response } from "express";
import { getUserRatings as dbGetUserRatings, upsertUserRatings, getUserProfile as dbGetUserProfile, upsertUserProfile, getAllUsernames } from "./dataController";

// Get user ratings from database only
export async function getUserRatings(req: Request, res: Response): Promise<void> {
    const { username } = req.params;
    const { fallback } = req.query;

    if (!username) {
      res.status(400).json({ error: "Username is required" });
      return;
    }

    console.log(`Retrieving ratings from database for user: ${username}`);

    try {
      const dbResult = await dbGetUserRatings(username);

      if (dbResult.success && dbResult.data && dbResult.data.length > 0) {
        const ratings = dbResult.data.map((item: any) => ({
          rating: item.rating,
          count: item.count,
        }));

        res.json({
          message: "User ratings retrieved from database",
          data: {
            username,
            ratings,
            timestamp: new Date().toISOString(),
            source: "database",
            success: true,
          },
        });
        return;
      }

      // Handle fallback to scraping if requested
      if (fallback === "scrape") {
        console.log(`No data in database, falling back to scraping for ${username}`);
        
        // Import scraper functions dynamically to avoid circular dependencies
        const { scrapeUserRatings } = await import("../scraperFunctions");

        try {
          const scrapedRatings = await scrapeUserRatings(username);
          
          // Save to database
          const insertResult = await upsertUserRatings(username, scrapedRatings);
          if (!insertResult.success) {
            console.warn("Failed to save scraped ratings to database:", insertResult.error);
          }

          res.json({
            message: "User ratings scraped and stored successfully",
            data: {
              username,
              ratings: scrapedRatings,
              timestamp: new Date().toISOString(),
              source: "scraped_fallback",
              success: true,
            },
          });
          return;
        } catch (scrapeError) {
          console.error("Fallback scraping failed:", scrapeError);
          res.status(500).json({
            error: `Scraping fallback failed: ${
              scrapeError instanceof Error ? scrapeError.message : "Unknown error"
            }`,
          });
          return;
        }
      }

      // No data found and no fallback requested
      res.status(404).json({
        error: `No ratings found in database for user: ${username}`,
        message: "Use query parameter ?fallback=scrape to automatically scrape data, or use the scraper endpoints to fetch data first",
      });
    } catch (error) {
      console.error("Error in getUserRatings:", error);
      res.status(500).json({
        error: `Failed to get user ratings: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
}

// Get user profile from database only
export async function getUserProfile(req: Request, res: Response): Promise<void> {
    const { username } = req.params;
    const { fallback } = req.query;

    if (!username) {
      res.status(400).json({ error: "Username is required" });
      return;
    }

    console.log(`Retrieving profile from database for user: ${username}`);

    try {
      const profileResult = await dbGetUserProfile(username);

      if (profileResult.success && profileResult.data) {
        res.json({
          message: "User profile retrieved from database",
          data: {
            username: profileResult.data.username,
            displayName: profileResult.data.displayName,
            followers: profileResult.data.followers,
            following: profileResult.data.following,
            numberOfLists: profileResult.data.numberOfLists,
            source: "database",
            success: true,
          },
        });
        return;
      }

      // Handle fallback to scraping if requested
      if (fallback === "scrape") {
        console.log(`No profile in database, falling back to scraping for ${username}`);
        
        // Import scraper functions dynamically to avoid circular dependencies
        const { scrapeUserProfileData } = await import("../scraperFunctions");

        try {
          const scrapedProfile = await scrapeUserProfileData(username);
          
          // Save to database
          const insertResult = await upsertUserProfile(username, scrapedProfile);
          if (!insertResult.success) {
            console.warn("Failed to save scraped profile to database:", insertResult.error);
          }

          res.json({
            message: "User profile scraped and stored successfully",
            data: {
              username,
              displayName: scrapedProfile.displayName,
              followers: scrapedProfile.followers,
              following: scrapedProfile.following,
              numberOfLists: scrapedProfile.numberOfLists,
              source: "scraped_fallback",
              success: true,
            },
          });
          return;
        } catch (scrapeError) {
          console.error("Fallback scraping failed:", scrapeError);
          res.status(500).json({
            error: `Scraping fallback failed: ${
              scrapeError instanceof Error ? scrapeError.message : "Unknown error"
            }`,
          });
          return;
        }
      }

      // No data found and no fallback requested
      res.status(404).json({
        error: `No profile found in database for user: ${username}`,
        message: "Use query parameter ?fallback=scrape to automatically scrape data, or use the scraper endpoints to fetch data first",
      });
    } catch (error) {
      console.error("Error in getUserProfile:", error);
      res.status(500).json({
        error: `Failed to get user profile: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
}

// Get complete user data (profile + ratings) from database only
export async function getUserComplete(req: Request, res: Response): Promise<void> {
    const { username } = req.params;
    const { fallback } = req.query;

    if (!username) {
      res.status(400).json({ error: "Username is required" });
      return;
    }

    console.log(`Retrieving complete user data from database for: ${username}`);

    try {
      // Get profile data
      const profileResult = await dbGetUserProfile(username);

      // Get ratings data
      const ratingsResult = await dbGetUserRatings(username);

      const hasProfile = profileResult.success && profileResult.data;
      const hasRatings = ratingsResult.success && ratingsResult.data && ratingsResult.data.length > 0;

      // If we have both profile and ratings, return them
      if (hasProfile && hasRatings) {
        const ratings = ratingsResult.data!.map((item: any) => ({
          rating: item.rating,
          count: item.count,
        }));

        const totalRatings = ratings.reduce((sum: number, rating: any) => sum + rating.count, 0);

        res.json({
          message: "Complete user data retrieved from database",
          data: {
            username: profileResult.data!.username,
            displayName: profileResult.data!.displayName,
            followers: profileResult.data!.followers,
            following: profileResult.data!.following,
            numberOfLists: profileResult.data!.numberOfLists,
            totalRatings,
            ratings,
            source: "database",
            success: true,
          },
        });
        return;
      }

      // Handle fallback to scraping if requested and missing data
      if (fallback === "scrape") {
        console.log(`Missing data in database, falling back to scraping for ${username}`);
        
        // Import scraper functions dynamically to avoid circular dependencies
        const { scrapeUserProfileData, scrapeUserRatings } = await import("../scraperFunctions");

        try {
          let profileData = profileResult.data;
          let ratingsData = hasRatings ? ratingsResult.data!.map((item: any) => ({
            rating: item.rating,
            count: item.count,
          })) : [];

          // Scrape profile if missing
          if (!hasProfile) {
            const scrapedProfile = await scrapeUserProfileData(username);
            const insertResult = await upsertUserProfile(username, scrapedProfile);
            if (!insertResult.success) {
              console.warn("Failed to save scraped profile to database:", insertResult.error);
            }
            profileData = {
              username,
              displayName: scrapedProfile.displayName,
              followers: scrapedProfile.followers,
              following: scrapedProfile.following,
              numberOfLists: scrapedProfile.numberOfLists,
            };
          }

          // Scrape ratings if missing
          if (!hasRatings) {
            const scrapedRatings = await scrapeUserRatings(username);
            const insertResult = await upsertUserRatings(username, scrapedRatings);
            if (!insertResult.success) {
              console.warn("Failed to save scraped ratings to database:", insertResult.error);
            }
            ratingsData = scrapedRatings;
          }

          const totalRatings = ratingsData.reduce((sum: number, rating: any) => sum + rating.count, 0);

          res.json({
            message: "Complete user data retrieved (with scraping fallback)",
            data: {
              username: profileData!.username || username,
              displayName: profileData!.displayName,
              followers: profileData!.followers,
              following: profileData!.following,
              numberOfLists: profileData!.numberOfLists,
              totalRatings,
              ratings: ratingsData,
              source: hasProfile && hasRatings ? "database" : "mixed_fallback",
              success: true,
            },
          });
          return;
        } catch (scrapeError) {
          console.error("Fallback scraping failed:", scrapeError);
          res.status(500).json({
            error: `Scraping fallback failed: ${
              scrapeError instanceof Error ? scrapeError.message : "Unknown error"
            }`,
          });
          return;
        }
      }

      // No complete data found and no fallback requested
      const missingData = [];
      if (!hasProfile) missingData.push("profile");
      if (!hasRatings) missingData.push("ratings");

      res.status(404).json({
        error: `Incomplete user data in database for user: ${username}`,
        missing: missingData,
        message: "Use query parameter ?fallback=scrape to automatically scrape missing data, or use the scraper endpoints to fetch data first",
      });
    } catch (error) {
      console.error("Error in getUserComplete:", error);
      res.status(500).json({
        error: `Failed to get complete user data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
}

// Get list of all users with their display names
export async function getAllUsers(req: Request, res: Response): Promise<void> {
    console.log("Retrieving all users from database");

    try {
      const result = await getAllUsernames();

      if (result.success && result.data) {
        res.json({
          message: "Users retrieved successfully",
          data: result.data,
        });
      } else {
        res.status(500).json({
          error: result.error || "Failed to retrieve users",
        });
      }
    } catch (error) {
      console.error("Error in getAllUsers:", error);
      res.status(500).json({
        error: `Failed to get users: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      });
    }
}