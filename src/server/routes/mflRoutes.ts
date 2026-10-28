import { Router } from "express";
import { authenticateToken, authorizeEditor } from "../middleware/auth";
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
  getRosterView,
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
// Public, read-only roster view — any roster's films, points and total.
router.get(
  "/rosters/:rosterId",
  ...validateIntParam("rosterId"),
  handleValidationErrors,
  getRosterView,
);

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

// Editor or admin — per-route middleware, not router.use, because the reads
// above stay public. Scoring is an editor-grantable capability; the path stays
// /admin/* for backwards compatibility.
router.post(
  "/admin/movie-score",
  authenticateToken,
  authorizeEditor,
  upsertMflMovieScore,
);
router.delete(
  "/admin/movie-score/:scoringId",
  authenticateToken,
  authorizeEditor,
  ...validateIntParam("scoringId"),
  handleValidationErrors,
  deleteMflMovieScore,
);

export default router;
