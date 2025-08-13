import { supabase, supabaseAdmin } from "../config/database";
// import { ApiResponse } from '../types';

export class DataController {
  // User Ratings Management
  static async deleteUserRatings(
    username: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase
        .from("UserRatings")
        .delete()
        .eq("username", username);

      if (error) {
        console.error("Database delete error:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Database operation error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown database error",
      };
    }
  }

  static async insertUserRatings(
    username: string,
    ratings: Array<{ rating: number; count: number }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const insertData = ratings.map((rating) => ({
        username,
        rating: rating.rating,
        count: rating.count,
      }));

      const { error } = await supabase.from("UserRatings").insert(insertData);

      if (error) {
        console.error("Database insert error:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Database operation error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown database error",
      };
    }
  }

  static async upsertUserRatings(
    username: string,
    ratings: Array<{ rating: number; count: number }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // First delete existing ratings for this user
      const deleteResult = await this.deleteUserRatings(username);
      if (!deleteResult.success) {
        return deleteResult;
      }

      // Then insert new ratings
      return await this.insertUserRatings(username, ratings);
    } catch (error) {
      console.error("Database upsert error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown database error",
      };
    }
  }

  static async getUserRatings(username: string): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from("UserRatings")
        .select("*")
        .eq("username", username)
        .order("rating", { ascending: true });

      if (error) {
        console.error("Database select error:", error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      console.error("Database operation error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown database error",
      };
    }
  }

  static async getAllUsernames(): Promise<{
    success: boolean;
    data?: Array<{ username: string; displayName?: string }>;
    error?: string;
  }> {
    try {
      // Get unique usernames from UserRatings table
      const { data: ratingsData, error: ratingsError } = await supabase
        .from("UserRatings")
        .select("username")
        .order("username", { ascending: true });

      if (ratingsError) {
        console.error("Database select error:", ratingsError);
        return { success: false, error: ratingsError.message };
      }

      // Extract unique usernames
      const usernames = [
        ...new Set(ratingsData?.map((item: any) => item.username) || []),
      ];

      // Get display names for these users
      const { data: usersData, error: usersError } = await supabaseAdmin
        .from("Users")
        .select("lbusername, display_name")
        .in("lbusername", usernames);

      if (usersError) {
        console.error("Database select error for users:", usersError);
        // Continue without display names if users table query fails
      }

      // Create a map of usernames to display names
      const displayNameMap = new Map<string, string>();
      if (usersData) {
        usersData.forEach((user: any) => {
          displayNameMap.set(user.lbusername, user.display_name);
        });
      }

      // Combine usernames with display names
      const usersWithDisplayNames = usernames.map((username) => ({
        username,
        displayName: displayNameMap.get(username),
      }));

      return { success: true, data: usersWithDisplayNames };
    } catch (error) {
      console.error("Database operation error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown database error",
      };
    }
  }

  // Film Data Management (for future use)
  static async insertFilmData(
    filmData: any[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabase.from("Films").insert(filmData);

      if (error) {
        console.error("Database insert error:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Database insert error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown database error",
      };
    }
  }

  static async getFilmData(username: string): Promise<{
    success: boolean;
    data?: any[];
    error?: string;
  }> {
    try {
      const { data, error } = await supabase
        .from("Films")
        .select("*")
        .eq("username", username)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Database select error:", error);
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      console.error("Database operation error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown database error",
      };
    }
  }

  // Hater Rankings - Get all users with their average ratings and rating distributions
  static async getHaterRankings(): Promise<{
    success: boolean;
    data?: Array<{
      username: string;
      displayName?: string;
      averageRating: number;
      totalRatings: number;
      ratingDistribution: Array<{ rating: number; count: number }>;
    }>;
    error?: string;
  }> {
    try {
      // Get all user ratings data
      const { data: ratingsData, error: ratingsError } = await supabase
        .from("UserRatings")
        .select("*");

      if (ratingsError) {
        console.error("Database select error:", ratingsError);
        return { success: false, error: ratingsError.message };
      }

      if (!ratingsData || ratingsData.length === 0) {
        return { success: true, data: [] };
      }

      // Get all user profile data to get display names
      const { data: usersData, error: usersError } = await supabaseAdmin
        .from("Users")
        .select("lbusername, display_name");

      if (usersError) {
        console.error("Database select error for users:", usersError);
        // Continue without display names if users table query fails
      }

      // Create a map of usernames to display names
      const displayNameMap = new Map<string, string>();
      if (usersData) {
        usersData.forEach((user: any) => {
          displayNameMap.set(user.lbusername, user.display_name);
        });
      }

      // Calculate average ratings and rating distributions for each user
      const userRatingsMap = new Map<
        string,
        {
          totalRating: number;
          totalCount: number;
          distribution: Array<{ rating: number; count: number }>;
        }
      >();

      ratingsData.forEach((item: any) => {
        const { username, rating, count } = item;

        if (!userRatingsMap.has(username)) {
          userRatingsMap.set(username, {
            totalRating: 0,
            totalCount: 0,
            distribution: [],
          });
        }

        const userData = userRatingsMap.get(username)!;
        userData.totalRating += rating * count;
        userData.totalCount += count;
        userData.distribution.push({ rating, count });
      });

      // Calculate averages and sort by ascending order (lowest ratings first)
      const rankings = Array.from(userRatingsMap.entries())
        .map(([username, data]) => ({
          username,
          displayName: displayNameMap.get(username) || username,
          averageRating:
            data.totalCount > 0 ? data.totalRating / data.totalCount : 0,
          totalRatings: data.totalCount,
          ratingDistribution: data.distribution.sort(
            (a, b) => a.rating - b.rating
          ),
        }))
        .sort((a, b) => a.averageRating - b.averageRating);

      return { success: true, data: rankings };
    } catch (error) {
      console.error("Database operation error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown database error",
      };
    }
  }

  // User Profile Management
  static async getUserProfile(username: string): Promise<{
    success: boolean;
    data?: {
      username: string;
      displayName: string;
      followers: number;
      following: number;
      numberOfLists: number;
      createdAt?: string;
      updatedAt?: string;
    };
    error?: string;
  }> {
    try {
      const { data, error } = await supabaseAdmin
        .from("Users")
        .select("*")
        .eq("lbusername", username)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          // No rows found
          return { success: true };
        }
        console.error("Database select error:", error);
        return { success: false, error: error.message };
      }

      return {
        success: true,
        data: {
          username: data.lbusername,
          displayName: data.display_name,
          followers: data.followers,
          following: data.following,
          numberOfLists: data.number_of_lists,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
        },
      };
    } catch (error) {
      console.error("Database operation error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown database error",
      };
    }
  }

  static async upsertUserProfile(
    username: string,
    profileData: {
      displayName: string;
      followers: number;
      following: number;
      numberOfLists: number;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const insertData = {
        lbusername: username,
        display_name: profileData.displayName,
        followers: profileData.followers,
        following: profileData.following,
        number_of_lists: profileData.numberOfLists,
      };

      const { error } = await supabaseAdmin.from("Users").upsert(insertData);

      if (error) {
        console.error("Database upsert error:", error);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error("Database operation error:", error);
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown database error",
      };
    }
  }
}
