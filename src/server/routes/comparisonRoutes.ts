import { Router } from "express";
import {
  getAllUsernames,
  getUserRatings,
  compareUsers,
  getMoviesInCommon,
  getMovieSwap,
} from "../controllers/comparisonController";
import {
  dbGetHaterRankings,
  dbGetHaterRankings2,
} from "../controllers/dataController";

const router = Router();

router.get("/movie-swap", getMovieSwap);
router.get("/usernames", getAllUsernames);
router.post("/user-ratings", getUserRatings);
router.post("/compare", compareUsers);
router.post("/movies-in-common", getMoviesInCommon);

// Public hater rankings endpoint
router.get("/hater-rankings", async (req, res): Promise<void> => {
  try {
    const result = await dbGetHaterRankings();

    if (!result.success) {
      res
        .status(500)
        .json({ error: result.error || "Failed to get hater rankings" });
      return;
    }

    res.json({
      message: "Hater rankings retrieved successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("Error getting hater rankings:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});

// Public hater rankings endpoint
router.get("/v2/hater-rankings", async (req, res): Promise<void> => {
  try {
    const result = await dbGetHaterRankings2();

    if (!result.success) {
      console.log(result.error);
      res
        .status(500)
        .json({ error: result.error || "Failed to get hater rankings" });
      return;
    }

    res.json({
      message: "Hater rankings retrieved successfully",
      data: result.data,
    });
  } catch (error) {
    console.error("Error getting hater rankings:", error);
    res.status(500).json({
      error: error instanceof Error ? error.message : "Unknown error occurred",
    });
  }
});

export default router;
