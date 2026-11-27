import { Router } from "express";
import rateLimit from "express-rate-limit";
import { handleValidationErrors } from "../middleware/errorHandler";
import { validateFilmSlug } from "../middleware/validation";
import { getFilmCardImage } from "../controllers/ogController";

const router = Router();

// Requests are CDN misses from chat apps' media proxies, which share a few IPs.
const ogLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  skip: () => process.env.NODE_ENV !== "production",
  message: { error: "Too many image requests, please try again later." },
});

router.get(
  "/film/:filmSlug.png",
  [ogLimiter, ...validateFilmSlug, handleValidationErrors],
  getFilmCardImage,
);

export default router;
