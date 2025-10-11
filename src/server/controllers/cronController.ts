import { Request, Response } from "express";
import {
  getAllUsernames,
  upsertUserRatings,
  upsertUserProfile,
  upsertUserFilms,
} from "./dataController";
import {
  scrapeUserRatings,
  scrapeUserProfileData,
  scrapeUserFilms,
} from "../scraperFunctions";

/**
 * Refresh all users' data from Letterboxd
 * This endpoint is designed to be called by a cron job
 */
export async function refreshAllUsers(
  req: Request,
  res: Response
): Promise<void> {
  const startTime = Date.now();
  console.log("=== Starting scheduled refresh of all users ===");

  try {
    // Get all users from database
    const result = await getAllUsernames();

    if (!result.success || !result.data) {
      console.error("Failed to retrieve users from database");
      res.status(500).json({ error: "Failed to get users from database" });
      return;
    }

    const users = result.data;
    console.log(`Found ${users.length} users to refresh`);

    const results = {
      totalUsers: users.length,
      success: 0,
      failed: 0,
      skipped: 0,
      errors: [] as Array<{ username: string; error: string }>,
    };

    // Refresh each user sequentially to avoid rate limits
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      const progress = `[${i + 1}/${users.length}]`;

      try {
        if (user) {
          console.log(`${progress} Refreshing data for: ${user.username}`);

          // Scrape fresh profile and ratings data
          const [profile, ratings, films] = await Promise.all([
            scrapeUserProfileData(user.username),
            scrapeUserRatings(user.username),
            scrapeUserFilms(user.username),
          ]);

          // Update database with fresh data
          const [profileUpdate, ratingsUpdate, filmsUpdate] = await Promise.all(
            [
              upsertUserProfile(user.username, profile),
              upsertUserRatings(user.username, ratings),
              upsertUserFilms(user.username, films),
            ]
          );

          // Check if updates were successful
          if (
            !profileUpdate.success ||
            !ratingsUpdate.success ||
            !filmsUpdate.success
          ) {
            console.warn(
              `${progress} Partial update failure for ${user.username}`,
              {
                profileSuccess: profileUpdate.success,
                ratingsSuccess: ratingsUpdate.success,
                filmsSuccess: filmsUpdate.success,
              }
            );
          }

          results.success++;
          console.log(`${progress} ✓ Successfully refreshed ${user.username}`);

          // Rate limiting: wait 2 seconds between users to avoid getting blocked
          if (i < users.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Unknown error";
        console.error(
          `${progress} ✗ Failed to refresh ${user?.username}:`,
          errorMessage
        );

        results.failed++;
        results.errors.push({
          username: user?.username || "(user not found)",
          error: errorMessage,
        });

        // Continue with next user even if this one failed
      }
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const summary = {
      message: "Refresh completed",
      duration: `${duration}s`,
      results,
    };

    console.log("=== Refresh Summary ===");
    console.log(`Total users: ${results.totalUsers}`);
    console.log(`✓ Success: ${results.success}`);
    console.log(`✗ Failed: ${results.failed}`);
    console.log(`Duration: ${duration}s`);

    if (results.errors.length > 0) {
      console.log("Errors:");
      results.errors.forEach((err) => {
        console.log(`  - ${err.username}: ${err.error}`);
      });
    }

    res.json(summary);
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error("=== Cron job failed ===");
    console.error(errorMessage);

    res.status(500).json({
      error: "Refresh failed",
      message: errorMessage,
    });
  }
}

/**
 * Refresh a specific user's data
 * Useful for manual triggers or selective updates
 */
export async function refreshUser(req: Request, res: Response): Promise<void> {
  const { username } = req.params;

  if (!username) {
    res.status(400).json({ error: "Username is required" });
    return;
  }

  console.log(`Refreshing data for user: ${username}`);

  try {
    // Scrape fresh data
    const [profile, ratings, films] = await Promise.all([
      scrapeUserProfileData(username),
      scrapeUserRatings(username),
      scrapeUserFilms(username),
    ]);

    // Update database
    const [profileUpdate, ratingsUpdate, filmsUpdate] = await Promise.all([
      upsertUserProfile(username, profile),
      upsertUserRatings(username, ratings),
      upsertUserFilms(username, films),
    ]);

    if (
      !profileUpdate.success ||
      !ratingsUpdate.success ||
      !filmsUpdate.success
    ) {
      console.warn(`Partial update failure for ${username}`, {
        profileSuccess: profileUpdate.success,
        ratingsSuccess: ratingsUpdate.success,
        filmsSuccess: filmsUpdate.success,
      });

      res.status(500).json({
        error: "Partial update failure",
        details: {
          profile: profileUpdate.success ? "OK" : profileUpdate.error,
          ratings: ratingsUpdate.success ? "OK" : ratingsUpdate.error,
          films: filmsUpdate.success ? "OK" : filmsUpdate.error,
        },
      });
      return;
    }

    console.log(`✓ Successfully refreshed ${username}`);

    res.json({
      message: `Successfully refreshed data for ${username}`,
      data: {
        username,
        profile,
        ratingsCount: ratings.length,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.error(`Failed to refresh ${username}:`, errorMessage);

    res.status(500).json({
      error: `Failed to refresh user: ${username}`,
      message: errorMessage,
    });
  }
}
