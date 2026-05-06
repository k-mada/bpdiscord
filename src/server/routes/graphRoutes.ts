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

// Auth model for this router:
// All endpoints are public (no JWT required) — deliberately, not by
// accident. The CLAUDE.md convention is "database-first = public read,
// scraper = protected write", and the getActor / getMovie / getCostars /
// getCommonMovies endpoints write to the DB (they're cache-through).
// They're kept public because:
//   1. The source data is TMDB, which is itself public.
//   2. Writes are bounded: each request touches at most one actor + their
//      top-15 billed films, or one movie + its top-15 billed cast.
//   3. Per-IP rate limiters (below) cap the blast radius of abuse.
//   4. Keeping ingestion public lets unauthenticated users seed the graph
//      on demand — that's the whole point of the cache-through pattern.
// If TMDB quota or DB growth becomes an issue, move these behind the
// same JWT middleware as /api/scraper.

const router = Router();

// The path-finder runs a recursive CTE that is much more expensive than a
// typical read endpoint. Tight per-IP limit to keep the DB pool healthy
// under abuse, independent of the global /api limiter.
const pathFinderLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  message: { error: "Too many path-finder requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// Search is the chattiest endpoint: each call fans out to two TMDB search
// endpoints plus two DB queries, and is the likely target of incremental
// typeahead-style usage. Give it its own bucket so that a burst of search
// traffic doesn't starve the detail/ingestion endpoints.
const searchLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 60,
  message: { error: "Too many search requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

// The detail/ingestion endpoints may call TMDB on cache misses, but each
// call is bounded (one actor or one movie + top-15 cast). Moderate per-IP
// limit looser than search since these are typically user-initiated, not
// typeahead-driven.
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
