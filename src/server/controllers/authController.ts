import { Request, Response } from "express";
import { eq, sql } from "drizzle-orm";
import {
  createSupabaseClient,
  createSupabaseAdminClient,
} from "../config/database";
import { db } from "../db";
import { users, appUsers, userScrapeJobs } from "../db/schema";
import {
  SignupRequest,
  AuthRequest,
  AuthResponse,
  ApiResponse,
  PasswordResetRequest,
  PasswordResetConfirmRequest,
} from "../../shared/types";

// Exported for direct unit testing. Matches Letterboxd's actual username rules:
// 2-15 chars, lowercase alphanumeric + hyphen + underscore.
export const LBUSERNAME_FORMAT = /^[a-z0-9_-]{2,15}$/;

function normalizeLbusername(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class AuthController {
  static async signup(req: Request, res: Response): Promise<void> {
    try {
      const {
        name,
        email,
        password,
        lbusername: rawLbusername,
      }: SignupRequest = req.body;

      const lbusername = normalizeLbusername(rawLbusername);

      // Format check before we touch Supabase — cheap and avoids creating an
      // auth user we'll just have to delete.
      if (lbusername !== undefined && !LBUSERNAME_FORMAT.test(lbusername)) {
        res.status(400).json({
          error:
            "Letterboxd.com usernames must be 2–15 characters; letters, numbers, hyphens, underscores only.",
        });
        return;
      }

      // Fast-path uniqueness check. Race condition still caught at insert.
      if (lbusername !== undefined) {
        const existing = await db
          .select({ id: appUsers.id })
          .from(appUsers)
          .where(eq(appUsers.lbusername, lbusername))
          .limit(1);
        if (existing.length > 0) {
          res.status(409).json({
            error: "This Letterboxd.com username has already been claimed.",
          });
          return;
        }
      }

      const supabase = createSupabaseClient();

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { name, role: "user" } },
      });

      if (signUpError || !signUpData.user) {
        res
          .status(400)
          .json({ error: signUpError?.message ?? "Signup failed" });
        return;
      }

      const authUserId = signUpData.user.id;

      // Link in DB. On any failure, compensate by deleting the auth user so
      // signup is atomic from the client's perspective.
      let usersRowWasInserted: boolean;
      try {
        usersRowWasInserted = await db.transaction(async (tx) => {
          let wasInserted = false;
          if (lbusername !== undefined) {
            // ON CONFLICT DO UPDATE (not DO NOTHING) so we forcibly mark
            // is_discord=true even if the row was previously curated as
            // non-discord. The xmax system column distinguishes a fresh
            // INSERT (xmax=0) from a CONFLICT-driven UPDATE (xmax!=0) —
            // needed so we only enqueue a scrape for truly new rows.
            const insertedUsers = await tx
              .insert(users)
              .values({ lbusername, isDiscord: true })
              .onConflictDoUpdate({
                target: users.lbusername,
                set: { isDiscord: true },
              })
              .returning({
                lbusername: users.lbusername,
                wasInserted: sql<boolean>`(xmax = 0)`,
              });
            // onConflictDoUpdate always returns exactly one row; non-null asserted.
            wasInserted = insertedUsers[0]!.wasInserted;
          }

          await tx.insert(appUsers).values({
            id: authUserId,
            lbusername: lbusername ?? null,
          });

          return wasInserted;
        });
      } catch (dbErr) {
        try {
          const admin = createSupabaseAdminClient();
          await admin.auth.admin.deleteUser(authUserId);
        } catch (cleanupErr) {
          console.error(
            "Failed to clean up auth user after signup DB failure:",
            cleanupErr,
          );
        }

        if (
          dbErr instanceof Error &&
          (dbErr as { code?: string }).code === "23505"
        ) {
          res.status(409).json({
            error: "This Letterboxd.com username has already been claimed.",
          });
          return;
        }
        console.error("Signup DB error:", dbErr);
        res
          .status(500)
          .json({ error: "Internal server error during signup." });
        return;
      }

      // Async scrape enqueue for newly-created Users rows. Best-effort —
      // failures are logged but don't undo the signup; admin can retrigger.
      if (usersRowWasInserted && lbusername !== undefined) {
        try {
          await db.insert(userScrapeJobs).values({
            lbusername,
            status: "pending",
            startedBy: authUserId,
          });
        } catch (scrapeErr) {
          console.error(
            "Failed to enqueue scrape job at signup:",
            scrapeErr,
          );
        }
      }

      // Issue a session token in the same response so the client doesn't need
      // a second round-trip. Falls back to a 'check your email' instruction
      // below if Supabase is configured to require email confirmation.
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      if (signInError) {
        // Account was created successfully; auto-login (a convenience) failed.
        // Differentiate by reason so the client + status code reflect reality.
        const errCode = (signInError as { code?: string }).code;
        const errMsg = signInError.message?.toLowerCase() ?? "";
        const isEmailUnconfirmed =
          errCode === "email_not_confirmed" ||
          errMsg.includes("email not confirmed");

        if (isEmailUnconfirmed) {
          // Expected when Supabase requires email confirmation. The signup
          // itself succeeded; this is an instructional response, not an error.
          res.status(201).json({
            message:
              "Account created. Please check your email to confirm your account before signing in.",
          });
          return;
        }

        // Unexpected sign-in failure. Account exists, but we couldn't issue a
        // session. 500 signals the server-side problem; body tells the client
        // their account is usable once the underlying issue is resolved.
        console.error("Unexpected sign-in failure after signup:", signInError);
        res.status(500).json({
          error:
            "Account created, but automatic sign-in failed. Please try logging in manually.",
        });
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
