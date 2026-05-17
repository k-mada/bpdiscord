import { Router } from "express";
import rateLimit from "express-rate-limit";
import { handleValidationErrors } from "../middleware/errorHandler";
import {
  getTotalRatings,
  getAllUserFilms,
  getUserFilmsCount,
  getMissingFilms,
  getTopWatchedFilms,
  getTopRatedUserFilms,
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

router.get(
  "/top-watched-films",
  [statsLimiter, handleValidationErrors],
  getTopWatchedFilms,
);

router.get(
  "/top-rated-user-films",
  [statsLimiter, handleValidationErrors],
  getTopRatedUserFilms,
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
