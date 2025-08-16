import { Request, Response } from "express";
import { createSupabaseClient } from "../config/database";
import {
  SignupRequest,
  AuthRequest,
  AuthResponse,
  ApiResponse,
  PasswordResetRequest,
  PasswordResetConfirmRequest,
} from "../types";

export class AuthController {
  static async signup(req: Request, res: Response): Promise<void> {
    try {
      const { name, email, password }: SignupRequest = req.body;

      const supabase = createSupabaseClient();

      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { name, role: "user" },
        },
      });

      if (error) {
        const response: ApiResponse = { error: error.message };
        res.status(400).json(response);
        return;
      }

      // For development, also sign in the user immediately
      // In production, you might want to require email verification first
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        const response: ApiResponse = {
          error:
            "Account created but automatic login failed. Please log in manually.",
        };
        res.status(201).json(response);
        return;
      }

      console.log(
        "Signup and auto-login successful for user:",
        signInData.user?.email
      );
      console.log(
        "Session access token length:",
        signInData.session?.access_token?.length
      );

      const authResponse: AuthResponse = {
        message: "Account created and logged in successfully",
        access_token: signInData.session!.access_token,
        user: signInData.user!,
      };

      const response: ApiResponse<AuthResponse> = {
        message: "Account created and logged in successfully",
        data: authResponse,
      };

      res.status(201).json(response);
    } catch (err) {
      console.error("Signup error:", err);
      const response: ApiResponse = { error: "Internal server error" };
      res.status(500).json(response);
    }
  }

  static async login(req: Request, res: Response): Promise<void> {
    try {
      const { email, password }: AuthRequest = req.body;

      const supabase = createSupabaseClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        const response: ApiResponse = { error: error.message };
        res.status(401).json(response);
        return;
      }

      console.log("Login successful for user:", data.user?.email);
      console.log(
        "Session access token length:",
        data.session?.access_token?.length
      );

      const authResponse: AuthResponse = {
        message: "Login successful",
        access_token: data.session!.access_token,
        user: data.user!,
      };

      const response: ApiResponse<AuthResponse> = {
        message: "Login successful",
        data: authResponse,
      };

      res.json(response);
    } catch (err) {
      console.error("Login error:", err);
      const response: ApiResponse = { error: "Internal server error" };
      res.status(500).json(response);
    }
  }

  static async requestPasswordReset(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { email }: PasswordResetRequest = req.body;

      const supabase = createSupabaseClient();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${
          process.env.CLIENT_URL || "http://localhost:3000"
        }/reset-password`,
      });

      if (error) {
        const response: ApiResponse = { error: error.message };
        res.status(400).json(response);
        return;
      }

      const response: ApiResponse = {
        message: "Password reset email sent. Please check your email.",
      };

      res.json(response);
    } catch (err) {
      console.error("Password reset request error:", err);
      const response: ApiResponse = { error: "Internal server error" };
      res.status(500).json(response);
    }
  }

  static async confirmPasswordReset(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { password }: PasswordResetConfirmRequest = req.body;

      const supabase = createSupabaseClient();
      const { data, error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) {
        const response: ApiResponse = { error: error.message };
        res.status(400).json(response);
        return;
      }

      const authResponse: AuthResponse = {
        message: "Password updated successfully",
        user: data.user!,
      };

      const response: ApiResponse<AuthResponse> = {
        message: "Password updated successfully",
        data: authResponse,
      };

      res.json(response);
    } catch (err) {
      console.error("Password reset confirmation error:", err);
      const response: ApiResponse = { error: "Internal server error" };
      res.status(500).json(response);
    }
  }
}
