import { Request, Response } from "express";
import { ApiResponse } from "../../shared/types";
import {
  dbGetAllUsernames,
  dbGetUserRatings,
  dbGetUserProfile,
  dbGetMoviesInCommon,
  dbGetMovieSwap,
  dbGetCompatibilityExtremes,
  dbGetTasteCompatibility,
} from "./dataController";

// export class ComparisonController {
export async function getAllUsernames(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const result = await dbGetAllUsernames();

    if (!result.success) {
      const response: ApiResponse = {
        error: result.error || "Failed to get usernames",
      };
      res.status(500).json(response);
      return;
    }

    const response: ApiResponse = {
      message: "Usernames retrieved successfully",
      data: result.data,
    };

    // TODO: WHY BAD REQUEST?

    res.json(response);
  } catch (error) {
    console.error("Get usernames error:", error);
    const response: ApiResponse = {
      error: `Failed to get usernames: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
    res.status(500).json(response);
  }
}

export async function getUserRatings(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { username } = req.body;
    if (!username) {
      const response: ApiResponse = { error: "Username is required" };
      res.status(400).json(response);
      return;
    }

    // Get both ratings and profile data
    const [ratingsResult, profileResult] = await Promise.all([
      dbGetUserRatings(username),
      dbGetUserProfile(username),
    ]);

    if (!ratingsResult.success) {
      const response: ApiResponse = {
        error: ratingsResult.error || "Failed to get user ratings",
      };
      res.status(500).json(response);
      return;
    }

    // Transform the ratings data to match the expected format
    const ratings =
      ratingsResult.data?.map((item) => ({
        rating: item.rating,
        count: item.count ?? 0,
      })) || [];

    // Calculate total films rated
    const totalFilms = ratings.reduce((sum, r) => sum + r.count, 0);

    const response: ApiResponse = {
      message: "User ratings retrieved successfully",
      data: {
        username,
        displayName: profileResult.data?.displayName || username,
        followers: profileResult.data?.followers || 0,
        following: profileResult.data?.following || 0,
        numberOfLists: profileResult.data?.numberOfLists || 0,
        totalFilms,
        ratings,
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Get user ratings error:", error);
    const response: ApiResponse = {
      error: `Failed to get user ratings: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
    res.status(500).json(response);
  }
}

export async function compareUsers(req: Request, res: Response): Promise<void> {
  try {
    const { user1, user2 } = req.body;

    if (!user1 || !user2) {
      const response: ApiResponse = {
        error: "Both user1 and user2 are required",
      };
      res.status(400).json(response);
      return;
    }

    // Get ratings for both users
    const [result1, result2] = await Promise.all([
      dbGetUserRatings(user1),
      dbGetUserRatings(user2),
    ]);

    if (!result1.success || !result2.success) {
      const response: ApiResponse = {
        error: "Failed to retrieve user ratings",
      };
      res.status(500).json(response);
      return;
    }

    // Transform the data
    const ratings1 =
      result1.data?.map((item) => ({
        rating: item.rating,
        count: item.count,
      })) || [];

    const ratings2 =
      result2.data?.map((item) => ({
        rating: item.rating,
        count: item.count,
      })) || [];

    const response: ApiResponse = {
      message: "User comparison retrieved successfully",
      data: {
        user1: {
          username: user1,
          ratings: ratings1,
        },
        user2: {
          username: user2,
          ratings: ratings2,
        },
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Compare users error:", error);
    const response: ApiResponse = {
      error: `Failed to compare users: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
    res.status(500).json(response);
  }
}

export async function getMoviesInCommon(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { user1, user2 } = req.body;

    if (!user1 || !user2) {
      const response: ApiResponse = {
        error: "Both user1 and user2 are required",
      };
      res.status(400).json(response);
      return;
    }

    if (user1 === user2) {
      const response: ApiResponse = {
        error: "Cannot compare user with themselves",
      };
      res.status(400).json(response);
      return;
    }

    const [result, compat] = await Promise.all([
      dbGetMoviesInCommon(user1, user2),
      dbGetTasteCompatibility(user1, user2),
    ]);

    if (!result.success || !compat.success) {
      const response: ApiResponse = {
        error: result.error || compat.error || "Failed to get movies in common",
      };
      res.status(500).json(response);
      return;
    }

    const response: ApiResponse = {
      message: "Movies in common retrieved successfully",
      data: {
        user1,
        user2,
        moviesInCommon: result.data || [],
        count: result.count || 0,
        compatibility: compat.data ?? {
          pearson: null,
          mad: null,
          sampleSize: 0,
        },
      },
    };

    res.json(response);
  } catch (error) {
    console.error("Get movies in common error:", error);
    const response: ApiResponse = {
      error: `Failed to get movies in common: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
    res.status(500).json(response);
  }
}

export async function getCompatibilityExtremes(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const { username } = req.params;
    if (!username) {
      const response: ApiResponse = { error: "username is required" };
      res.status(400).json(response);
      return;
    }

    const result = await dbGetCompatibilityExtremes(username);

    if (!result.success) {
      const response: ApiResponse = {
        error: result.error || "Failed to compute compatibility extremes",
      };
      res.status(500).json(response);
      return;
    }

    const response: ApiResponse = {
      message: "Compatibility extremes retrieved successfully",
      data: result.data,
    };
    res.json(response);
  } catch (error) {
    console.error("Get compatibility extremes error:", error);
    const response: ApiResponse = {
      error: `Failed to get compatibility extremes: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
    res.status(500).json(response);
  }
}

export async function getMovieSwap(req: Request, res: Response): Promise<void> {
  try {
    const userA = req.query.userA?.toString().trim();
    const userB = req.query.userB?.toString().trim();

    if (!userA || !userB) {
      const response: ApiResponse = {
        error: "Both userA and userB are required",
      };
      res.status(400).json(response);
      return;
    }

    if (userA === userB) {
      const response: ApiResponse = {
        error: "Cannot compare a user with themselves",
      };
      res.status(400).json(response);
      return;
    }

    const result = await dbGetMovieSwap(userA, userB);

    if (!result.success) {
      const response: ApiResponse = {
        error: result.error || "Failed to get movie swap",
      };
      res.status(500).json(response);
      return;
    }

    const response: ApiResponse = {
      message: "Movie swap retrieved successfully",
      data: result.data,
    };
    res.json(response);
  } catch (error) {
    console.error("Get movie swap error:", error);
    const response: ApiResponse = {
      error: `Failed to get movie swap: ${
        error instanceof Error ? error.message : "Unknown error"
      }`,
    };
    res.status(500).json(response);
  }
}
// }
