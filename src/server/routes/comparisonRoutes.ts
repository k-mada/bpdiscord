import { Router } from "express";
import { ComparisonController } from "../controllers/comparisonController";
import { DataController } from "../controllers/dataController";

const router = Router();

router.get("/usernames", ComparisonController.getAllUsernames);
router.post("/user-ratings", ComparisonController.getUserRatings);
router.post("/compare", ComparisonController.compareUsers);
router.post("/movies-in-common", ComparisonController.getMoviesInCommon);

// Public hater rankings endpoint
router.get("/hater-rankings", async (req, res): Promise<void> => {
  try {
    const result = await DataController.getHaterRankings();

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

export default router;
