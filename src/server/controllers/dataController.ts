import { supabase, supabaseAdmin } from "../config/database";
import { UserFilm } from "../types";
// import { ApiResponse } from '../types';

export class DataController {
  // User Ratings Management
  static async deleteUserRatings(
    username: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabaseAdmin
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

  static async upsertUserRatings(
    username: string,
    ratings: Array<{ rating: number; count: number }>
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Prepare data for upsert
      const ratingsToUpsert = ratings.map((rating) => ({
        username,
        rating: rating.rating,
        count: rating.count,
        updated_at: new Date().toISOString(),
      }));

      // Use Supabase's upsert functionality with proper conflict resolution
      const { error } = await supabaseAdmin
        .from("UserRatings")
        .upsert(ratingsToUpsert, {
          onConflict: "username,rating",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error("Database upsert error:", error);
        return {
          success: false,
          error: error.message,
        };
      }

      console.log(
        `Successfully upserted ${ratings.length} ratings for user ${username}`
      );
      return { success: true };
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
      // Always get data from database - no scraping logic here
      const { data, error } = await supabaseAdmin
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
      const { data: ratingsData, error: ratingsError } = await supabaseAdmin
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
        displayName: displayNameMap.get(username) || username,
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
      const { data: ratingsData, error: ratingsError } = await supabaseAdmin
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
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabaseAdmin.from("Users").upsert(insertData, {
        onConflict: "lbusername",
        ignoreDuplicates: false,
      });

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

  // UserFilms Management Methods
  static async getUserFilms(lbusername: string): Promise<{
    success: boolean;
    data?: (UserFilm & {
      created_at: string;
      updated_at: string;
    })[];
    error?: string;
  }> {
    try {
      const { data, error } = await supabaseAdmin
        .from("UserFilms")
        .select("film_slug, title, rating, liked, created_at, updated_at")
        .eq("lbusername", lbusername)
        .order("created_at", { ascending: false });

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true, data: data || [] };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  static async upsertUserFilms(
    lbusername: string,
    films: UserFilm[]
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const filmsToUpsert = films.map((film) => ({
        lbusername,
        film_slug: film.film_slug,
        title: film.title,
        rating: film.rating,
        liked: film.liked || false,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabaseAdmin
        .from("UserFilms")
        .upsert(filmsToUpsert, {
          onConflict: "lbusername,film_slug",
          ignoreDuplicates: false,
        });

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

  static async deleteUserFilms(
    lbusername: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const { error } = await supabaseAdmin
        .from("UserFilms")
        .delete()
        .eq("lbusername", lbusername);

      if (error) {
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  // Get movies in common between two users
  static async getMoviesInCommon(
    user1: string,
    user2: string
  ): Promise<{
    success: boolean;
    data?: Array<{
      title: string;
      user1_rating: number;
      user2_rating: number;
    }>;
    count?: number;
    error?: string;
  }> {
    try {
      console.log("getting movies in common between", user1, "and", user2);
      // Query to find movies in common between two users
      // First get user1's films
      const { data: user1Films, error: user1Error } = await supabaseAdmin
        .from("UserFilms")
        .select("title, rating")
        .eq("lbusername", user1);

      if (user1Error) {
        console.error("Database query error for user1:", user1Error);
        return { success: false, error: user1Error.message };
      }

      // Then get user2's films
      const { data: user2Films, error: user2Error } = await supabaseAdmin
        .from("UserFilms")
        .select("title, rating")
        .eq("lbusername", user2);

      if (user2Error) {
        console.error("Database query error for user2:", user2Error);
        return { success: false, error: user2Error.message };
      }

      // Find common movies
      const user1FilmsMap = new Map<string, number>();
      user1Films?.forEach((film) => {
        user1FilmsMap.set(film.title, film.rating);
      });

      const commonMovies: Array<{
        title: string;
        user1_rating: number;
        user2_rating: number;
      }> = [];

      user2Films?.forEach((film) => {
        if (user1FilmsMap.has(film.title)) {
          commonMovies.push({
            title: film.title,
            user1_rating: user1FilmsMap.get(film.title)!,
            user2_rating: film.rating,
          });
        }
      });

      // Sort by title for consistent ordering
      commonMovies.sort((a, b) => a.title.localeCompare(b.title));

      return {
        success: true,
        data: commonMovies,
        count: commonMovies.length,
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
}
