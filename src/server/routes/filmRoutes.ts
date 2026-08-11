import { Router } from "express";
import rateLimit from "express-rate-limit";
import { handleValidationErrors } from "../middleware/errorHandler";
import { validateFilmSlug } from "../middleware/validation";
import { getFilmDetail } from "../controllers/filmController";

const router = Router();

const filmsLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 200,
  skip: () => process.env.NODE_ENV !== "production",
  message: { error: "Too many film requests, please try again later." },
});

router.get(
  "/:filmSlug",
  [filmsLimiter, ...validateFilmSlug, handleValidationErrors],
  getFilmDetail,
);

export default router;
