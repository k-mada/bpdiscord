import { Router } from "express";
import { authenticateToken, authorizeAdmin } from "../middleware/auth";
import { handleValidationErrors } from "../middleware/errorHandler";
import { validateIntParam } from "../middleware/validation";
import {
  getMFLScoringMetrics,
  getMFLUserScores,
  getMFLMovies,
  getMflMovieScore,
  upsertMflMovieScore,
  deleteMflMovieScore,
  getMflUserPicks,
  addMflUserPick,
  removeMflUserPick,
} from "../controllers/mflController";

const router = Router();

// Public reads
router.get("/scoring-metrics", getMFLScoringMetrics);
router.get("/user-scores/:username", getMFLUserScores);
router.get("/movie-score/:filmSlug", getMflMovieScore);
router.get("/movies", getMFLMovies);

// The handler resolves identity from the JWT; no username in the URL to gate.
router.get("/picks", authenticateToken, getMflUserPicks);
router.post("/picks", authenticateToken, addMflUserPick);
router.delete("/picks/:filmSlug", authenticateToken, removeMflUserPick);

// Admin — per-route middleware, not router.use, because the reads above stay
// public.
router.post(
  "/admin/movie-score",
  authenticateToken,
  authorizeAdmin,
  upsertMflMovieScore,
);
router.delete(
  "/admin/movie-score/:scoringId",
  authenticateToken,
  authorizeAdmin,
  ...validateIntParam("scoringId"),
  handleValidationErrors,
  deleteMflMovieScore,
);

export default router;
