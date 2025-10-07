import { Router } from "express";
import rateLimit from "express-rate-limit";
import { handleValidationErrors } from "../middleware/errorHandler";
import { getTotalRatings } from "../controllers/statsController";

const router = Router();

const scraperLimiter = rateLimit({
  windowMs: 2 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 scraping requests per windowMs
  message: { error: "Too many stats requests, please try again later." },
});

router.get(
  "/total-ratings",
  [scraperLimiter, handleValidationErrors],
  getTotalRatings
);

export default router;
