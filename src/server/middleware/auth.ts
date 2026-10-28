import { Request, Response, NextFunction } from "express";
import { createSupabaseClient } from "../config/database";
import { Role, SupabaseUser } from "../types";

// app_metadata is the authoritative, service-role-only claim. user_metadata
// is the legacy location, read only as a fallback until the prod backfill
// completes — remove it once every account has app_metadata.role.
export const resolveRole = (user?: SupabaseUser): Role | undefined =>
  user?.app_metadata?.role ?? user?.user_metadata?.role;

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

    const supabase = createSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (error || !user) {
      res.status(403).json({ error: "Invalid or expired token" });
      return;
    }

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

  if (resolveRole(req.user) === "admin") {
    next();
    return;
  }

  res
    .status(403)
    .json({ error: "Access denied. You can only access your own data." });
};

export const authorizeAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (resolveRole(req.user) === "admin") {
    next();
    return;
  }

  res.status(403).json({ error: "Admin access required" });
};
