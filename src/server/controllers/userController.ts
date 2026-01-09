import { Request, Response } from "express";
import {
  CreateUserRequest,
  UpdateUserRequest,
  User,
  ApiResponse,
} from "../types";

export class UserController {
  static async createUser(req: Request, res: Response): Promise<void> {
    try {
      const { name, email }: CreateUserRequest = req.body;

      if (!req.user) {
        const response: ApiResponse = { error: "Authentication required" };
        res.status(401).json(response);
        return;
      }

      // Only allow users to create their own profile or admins to create any
      if (
        email !== req.user.email &&
        req.user.user_metadata?.role !== "admin"
      ) {
        const response: ApiResponse = {
          error: "Can only create your own user profile",
        };
        res.status(403).json(response);
        return;
      }

      if (!req.supabase) {
        const response: ApiResponse = { error: "Database connection error" };
        res.status(500).json(response);
        return;
      }

      const { data, error } = await req.supabase
        .from("users")
        .insert([
          {
            id: req.user.id,
            name,
            email: req.user.email!,
          },
        ])
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        const response: ApiResponse = { error: error.message };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse<User> = {
        data: data as User,
        message: "User profile created successfully",
      };

      res.status(201).json(response);
    } catch (err) {
      console.error("Server error:", err);
      const response: ApiResponse = { error: "Internal server error" };
      res.status(500).json(response);
    }
  }

  static async getAllUsers(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = { error: "Authentication required" };
        res.status(401).json(response);
        return;
      }

      // Only admins can see all users
      if (req.user.user_metadata?.role !== "admin") {
        const response: ApiResponse = { error: "Admin access required" };
        res.status(403).json(response);
        return;
      }

      if (!req.supabase) {
        const response: ApiResponse = { error: "Database connection error" };
        res.status(500).json(response);
        return;
      }

      const { data, error } = await req.supabase
        .from("users")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Supabase error:", error);
        const response: ApiResponse = { error: error.message };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse<User[]> = {
        data: data as User[],
        count: data.length,
      };

      res.json(response);
    } catch (err) {
      console.error("Server error:", err);
      const response: ApiResponse = { error: "Internal server error" };
      res.status(500).json(response);
    }
  }

  static async getMyProfile(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = { error: "Authentication required" };
        res.status(401).json(response);
        return;
      }

      if (!req.supabase) {
        const response: ApiResponse = { error: "Database connection error" };
        res.status(500).json(response);
        return;
      }

      const { data, error } = await req.supabase
        .from("users")
        .select("*")
        .eq("id", req.user.id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          const response: ApiResponse = { error: "User profile not found" };
          res.status(404).json(response);
          return;
        }
        console.error("Supabase error:", error);
        const response: ApiResponse = { error: error.message };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse<User> = { data: data as User };
      res.json(response);
    } catch (err) {
      console.error("Server error:", err);
      const response: ApiResponse = { error: "Internal server error" };
      res.status(500).json(response);
    }
  }

  static async getUserById(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = { error: "Authentication required" };
        res.status(401).json(response);
        return;
      }

      if (!req.supabase) {
        const response: ApiResponse = { error: "Database connection error" };
        res.status(500).json(response);
        return;
      }

      const { id } = req.params;

      const { data, error } = await req.supabase
        .from("users")
        .select("*")
        .eq("id", id)
        .single();

      if (error) {
        if (error.code === "PGRST116") {
          const response: ApiResponse = { error: "User not found" };
          res.status(404).json(response);
          return;
        }
        console.error("Supabase error:", error);
        const response: ApiResponse = { error: error.message };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse<User> = { data: data as User };
      res.json(response);
    } catch (err) {
      console.error("Server error:", err);
      const response: ApiResponse = { error: "Internal server error" };
      res.status(500).json(response);
    }
  }

  static async updateUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = { error: "Authentication required" };
        res.status(401).json(response);
        return;
      }

      if (!req.supabase) {
        const response: ApiResponse = { error: "Database connection error" };
        res.status(500).json(response);
        return;
      }

      const { id } = req.params;
      const { name, email }: UpdateUserRequest = req.body;

      if (!name && !email) {
        const response: ApiResponse = {
          error: "At least one field (name or email) is required",
        };
        res.status(400).json(response);
        return;
      }

      const updateData: Partial<User> = {};
      if (name) updateData.name = name;
      if (email) updateData.email = email;

      const { data, error } = await req.supabase
        .from("users")
        .update(updateData)
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        const response: ApiResponse = { error: error.message };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse<User> = {
        data: data as User,
        message: "User updated successfully",
      };

      res.json(response);
    } catch (err) {
      console.error("Server error:", err);
      const response: ApiResponse = { error: "Internal server error" };
      res.status(500).json(response);
    }
  }

  static async deleteUser(req: Request, res: Response): Promise<void> {
    try {
      if (!req.user) {
        const response: ApiResponse = { error: "Authentication required" };
        res.status(401).json(response);
        return;
      }

      if (!req.supabase) {
        const response: ApiResponse = { error: "Database connection error" };
        res.status(500).json(response);
        return;
      }

      const { id } = req.params;

      const { data, error } = await req.supabase
        .from("users")
        .delete()
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Supabase error:", error);
        const response: ApiResponse = { error: error.message };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse<User> = {
        message: "User deleted successfully",
        data: data as User,
      };

      res.json(response);
    } catch (err) {
      console.error("Server error:", err);
      const response: ApiResponse = { error: "Internal server error" };
      res.status(500).json(response);
    }
  }
}
