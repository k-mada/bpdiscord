import { Router } from "express";
import rateLimit from "express-rate-limit";
import { handleValidationErrors } from "../middleware/errorHandler";
import {
  getTotalRatings,
  getAllUserFilms,
  getUserFilmsCount,
  getMissingFilms,
  getRatingDifferential,
  getTopFilmsByYear,
} from "../controllers/statsController";

const router = Router();

const statsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 200,
  skip: () => process.env.NODE_ENV !== "production",
  message: { error: "Too many stats requests, please try again later." },
});

router.get(
  "/total-ratings",
  [statsLimiter, handleValidationErrors],
  getTotalRatings,
);

router.get(
  "/all-user-films",
  [statsLimiter, handleValidationErrors],
  getAllUserFilms,
);

// Optional param (Express 4 `:year?`): /top-films → all-time,
// /top-films/:year → that release year. Express 5 would need `{/:year}`.
router.get(
  "/top-films/:year?",
  [statsLimiter, handleValidationErrors],
  getTopFilmsByYear,
);

// Optional param, same Express-4 `:year?` shape as /top-films: bare → all-time,
// /:year → films released that year.
router.get(
  "/rating-differential/:year?",
  [statsLimiter, handleValidationErrors],
  getRatingDifferential,
);

router.get(
  "/user-films-count",
  [statsLimiter, handleValidationErrors],
  getUserFilmsCount,
);

router.get(
  "/get-missing-films",
  [statsLimiter, handleValidationErrors],
  getMissingFilms,
);

export default router;
