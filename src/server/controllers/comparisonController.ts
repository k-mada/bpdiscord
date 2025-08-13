import { Request, Response } from "express";
import { ApiResponse } from "../types";
import { DataController } from "./dataController";

export class ComparisonController {
  static async getAllUsernames(req: Request, res: Response): Promise<void> {
    try {
      const result = await DataController.getAllUsernames();

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

  static async getUserRatings(req: Request, res: Response): Promise<void> {
    try {
      const { username } = req.body;
      if (!username) {
        const response: ApiResponse = { error: "Username is required" };
        res.status(400).json(response);
        return;
      }

      // Get both ratings and profile data
      const [ratingsResult, profileResult] = await Promise.all([
        DataController.getUserRatings(username),
        DataController.getUserProfile(username),
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
        ratingsResult.data?.map((item: any) => ({
          rating: item.rating,
          count: item.count,
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

  static async compareUsers(req: Request, res: Response): Promise<void> {
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
        DataController.getUserRatings(user1),
        DataController.getUserRatings(user2),
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
        result1.data?.map((item: any) => ({
          rating: item.rating,
          count: item.count,
        })) || [];

      const ratings2 =
        result2.data?.map((item: any) => ({
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
}
