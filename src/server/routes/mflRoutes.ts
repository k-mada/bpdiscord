import { Router } from "express";
import {
  getMFLScoringMetrics,
  getMFLUserScores,
  getMFLMovies,
  getMflMovieScore,
  upsertMflMovieScore,
  deleteMflScoringMetric,
} from "../controllers/mflController";

const router = Router();

router.get("/scoring-metrics", getMFLScoringMetrics);
router.get("/user-scores/:username", getMFLUserScores);
router.get("/movie-score/:filmSlug", getMflMovieScore);
router.get("/movies", getMFLMovies);
router.post("/upsert-movie-score", upsertMflMovieScore);
router.delete("/delete-scoring-metric/:scoringId", deleteMflScoringMetric);
export default router;
