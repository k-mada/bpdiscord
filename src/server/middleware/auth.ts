import { Request, Response, NextFunction } from "express";
import { createSupabaseClient } from "../config/database";
import { SupabaseUser } from "../types";

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers["authorization"];
    let token = authHeader?.split(" ")[1]; // Bearer TOKEN

    // fallback to check x_authorization
    if (!token) {
      token = req.headers["x_authorization"]?.toString().split(" ")[1];
    }

    if (!token) {
      res.status(401).json({ error: "Access token required" });
      return;
    }

    // Verify token with Supabase
    const supabase = createSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) {
      res.status(403).json({ error: "Invalid or expired token" });
      return;
    }

    // Add user info to request object
    req.user = user as SupabaseUser;
    req.supabase = createSupabaseClient(token);

    next();
  } catch (error) {
    console.error("Auth middleware error:", error);
    res.status(403).json({ error: "Token verification failed" });
  }
};

export const authorizeOwnerOrAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const { id } = req.params;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  // If user is trying to access their own data, allow it
  if (id === userId) {
    next();
    return;
  }

  // Check if user has admin role
  if (req.user?.user_metadata?.role === "admin") {
    next();
    return;
  }

  res
    .status(403)
    .json({ error: "Access denied. You can only access your own data." });
};
