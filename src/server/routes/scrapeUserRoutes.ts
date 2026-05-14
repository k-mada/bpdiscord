import { Router } from "express";
import rateLimit from "express-rate-limit";

import { authenticateToken } from "../middleware/auth";
import { handleValidationErrors } from "../middleware/errorHandler";
import { validateUUIDParam } from "../middleware/validation";
import {
  cancelScrapeJob,
  getScrapeJob,
  triggerScrapeUser,
} from "../controllers/userScrapeJobController";

const router = Router();

// All /api/scrape-user/* require a valid JWT — but NOT admin. Any
// authenticated user can refresh their (or anyone's) /fetcher data.
router.use(authenticateToken);

// Per-username rate limit for the trigger endpoint. A burst on one
// username won't affect scrapes for other users. Looser than the legacy
// SSE limiter (20/15min/IP) because the worker handles the work
// asynchronously and the per-username partial unique index in SQL
// already prevents true duplicate work.
const triggerLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  keyGenerator: (req) => `scrape-trigger:${req.params.username ?? "unknown"}`,
  message: { error: "Too many scrape requests for this user — try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Polling endpoint is hit every 2s by the client during an active job —
// give it room. Per-IP since job ids are unguessable UUIDs.
const pollLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120, // 2/sec sustained is the polling cadence
  message: { error: "Too many requests — slow down polling." },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/scrape-user/:username — trigger a per-user refresh.
router.post("/:username", triggerLimiter, triggerScrapeUser);

// GET /api/scrape-user/jobs/:id — read job state for polling.
router.get(
  "/jobs/:id",
  pollLimiter,
  ...validateUUIDParam,
  handleValidationErrors,
  getScrapeJob,
);

// POST /api/scrape-user/jobs/:id/cancel — cancel a running job (own only).
router.post(
  "/jobs/:id/cancel",
  ...validateUUIDParam,
  handleValidationErrors,
  cancelScrapeJob,
);

export default router;
