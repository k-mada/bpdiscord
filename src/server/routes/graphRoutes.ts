import { Router } from "express";
import rateLimit from "express-rate-limit";
import {
  findActorPath,
  searchGraph,
  getActor,
  getMovie,
  getCostars,
  getCommonMovies,
} from "../controllers/graphController";

// These endpoints are cache-through writers but deliberately public — see
// CLAUDE.md "/api/actor-graph". Rate limiters below are the blast-radius cap.

const router = Router();

// Layered BFS is far heavier than a plain read; tight bucket keeps a bad
// actor pair from pinning the DB pool.
const pathFinderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { error: "Too many path-finder requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Own bucket: search fans out to two TMDB endpoints plus two DB queries and
// absorbs typeahead bursts that would otherwise starve ingestion.
const searchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: { error: "Too many search requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Looser than search — these are user-initiated, and each cache miss is
// bounded to one actor or one movie + top-15 cast.
const ingestionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 120,
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get(
  "/path-finder/:actor1Id/:actor2Id",
  pathFinderLimiter,
  findActorPath
);

router.get("/search", searchLimiter, searchGraph);
router.get("/actors/:tmdbId", ingestionLimiter, getActor);
router.get("/movies/:tmdbId", ingestionLimiter, getMovie);
router.get("/actors/:tmdbId/costars", ingestionLimiter, getCostars);
router.get(
  "/actors/:actor1Id/common-movies/:actor2Id",
  ingestionLimiter,
  getCommonMovies
);

export default router;
