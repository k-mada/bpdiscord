import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  getData,
  getUserRatings,
  getAllFilms,
  getUserProfile,
  fetchFilms,
  getLBFilmRatingsByUsername,
} from "../controllers/scraperController";
import { validateScraperRequest } from "../middleware/validation";
import { handleValidationErrors } from "../middleware/errorHandler";
import { authenticateToken } from "../middleware/auth";

const router = Router();

const scraperLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 scraping requests per windowMs
  message: { error: "Too many scraping requests, please try again later." },
});

// SSE endpoint for streaming film scraping updates (PUBLIC - no auth required)
router.get(
  "/stream-films/:username",
  [scraperLimiter, handleValidationErrors],
  fetchFilms
);

router.get(
  "/update-lb-films/:username",
  [scraperLimiter, handleValidationErrors],
  getLBFilmRatingsByUsername
);

// Apply authentication to remaining scraper routes
router.use(authenticateToken);

// Protected scraper routes
router.post(
  "/getData",
  [scraperLimiter, ...validateScraperRequest, handleValidationErrors],
  getData
);

router.post(
  "/getUserRatings",
  [scraperLimiter, handleValidationErrors],
  getUserRatings
);

router.post(
  "/getAllFilms",
  [scraperLimiter, handleValidationErrors],
  getAllFilms
);

router.post(
  "/getUserProfile",
  [scraperLimiter, handleValidationErrors],
  getUserProfile
);

export default router;
