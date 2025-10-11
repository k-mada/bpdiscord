import { Router } from "express";
import { refreshAllUsers, refreshUser } from "../controllers/cronController";
import { validateCronSecret } from "../middleware/cronAuth";

const router = Router();

// All cron routes require authentication
router.use(validateCronSecret);

/**
 * POST /api/cron/refresh-all-users
 * Refresh all users' data from Letterboxd
 * Called by Vercel Cron or manual trigger with Bearer token
 */
router.post("/refresh-all-users", refreshAllUsers);

/**
 * POST /api/cron/refresh-user/:username
 * Refresh a specific user's data
 * Useful for manual triggers or selective updates
 */
router.post("/refresh-user/:username", refreshUser);

export default router;
