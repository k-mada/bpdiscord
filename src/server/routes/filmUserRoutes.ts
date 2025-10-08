import { Router } from "express";
import { getUserRatings, getUserProfile, getUserComplete, getAllUsers } from "../controllers/filmUserController";

const router = Router();

// Database-first routes for Letterboxd user data (no authentication required for reading)
// These routes only query the database and return 404 if data not found
// Add ?fallback=scrape query parameter to enable scraping fallback

// Get user ratings from database
router.get("/:username/ratings", getUserRatings);

// Get user profile from database
router.get("/:username/profile", getUserProfile);

// Get complete user data (profile + ratings) from database
router.get("/:username/complete", getUserComplete);

// Get list of all users with display names
router.get("/", getAllUsers);

export default router;