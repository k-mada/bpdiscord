import { Router } from "express";
import { authenticateToken, authorizeAdmin } from "../middleware/auth";
import { handleValidationErrors } from "../middleware/errorHandler";
import { validateIntParam } from "../middleware/validation";
import {
  getMFLScoringMetrics,
  getMFLUserScores,
  getMFLLeaderboard,
  getMFLMovies,
  getMflMovieScore,
  upsertMflMovieScore,
  deleteMflMovieScore,
  listRosters,
  getRosterPicks,
  createRoster,
  updateRoster,
  deleteRoster,
} from "../controllers/mflController";

const router = Router();

// Public reads
router.get("/scoring-metrics", getMFLScoringMetrics);
router.get("/user-scores/:username", getMFLUserScores);
router.get("/leaderboard", getMFLLeaderboard);
router.get("/movie-score/:filmSlug", getMflMovieScore);
router.get("/movies", getMFLMovies);

// Roster CRUD. The handler resolves identity from the JWT; every :rosterId route
// verifies the roster belongs to the caller before touching it.
router.get("/rosters", authenticateToken, listRosters);
router.post("/rosters", authenticateToken, createRoster);
router.get(
  "/rosters/:rosterId/picks",
  authenticateToken,
  ...validateIntParam("rosterId"),
  handleValidationErrors,
  getRosterPicks,
);
router.put(
  "/rosters/:rosterId",
  authenticateToken,
  ...validateIntParam("rosterId"),
  handleValidationErrors,
  updateRoster,
);
router.delete(
  "/rosters/:rosterId",
  authenticateToken,
  ...validateIntParam("rosterId"),
  handleValidationErrors,
  deleteRoster,
);

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
