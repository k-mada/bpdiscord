import { Request, Response, NextFunction } from "express";

/**
 * Middleware to validate cron job requests
 * Supports both Vercel Cron (automatic header) and manual triggers (Bearer token)
 */
export function validateCronSecret(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Check for Vercel Cron automatic header
  const vercelCronHeader = req.headers["x-vercel-cron-signature"];

  // Check for manual Bearer token
  const authHeader = req.headers["authorization"];
  const expectedSecret = process.env.CRON_SECRET;
  console.log("CRON_SECRET:", process.env.CRON_SECRET);

  // Debug logging
  console.log("=== Cron Auth Debug ===");
  console.log(
    "Vercel Cron Header:",
    vercelCronHeader ? "Present" : "Not present"
  );
  console.log(
    "Authorization Header:",
    authHeader ? `Present (${authHeader.substring(0, 20)}...)` : "Not present"
  );
  console.log(
    "Expected Secret:",
    expectedSecret ? `Set (${expectedSecret.substring(0, 10)}...)` : "NOT SET"
  );

  // Allow if Vercel Cron header present (Vercel automatically adds this)
  if (vercelCronHeader) {
    console.log("✓ Cron request authenticated via Vercel Cron header");
    return next();
  }

  // Allow if valid Bearer token provided
  if (expectedSecret && authHeader === `Bearer ${expectedSecret}`) {
    console.log("✓ Cron request authenticated via Bearer token");
    return next();
  }

  // Reject unauthorized requests
  console.warn("✗ Unauthorized cron request attempt");
  console.warn(
    "Auth failed - check that CRON_SECRET matches Authorization header"
  );
  res.status(401).json({
    error: "Unauthorized",
    message: "Valid cron authentication required",
  });
}
