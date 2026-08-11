import { Router } from "express";
import {
  getUserRatings,
  getUserProfile,
  getUserComplete,
  getAllUsers,
  getFilmsByUser,
} from "../controllers/filmUserController";

const router = Router();

router.get("/:username/ratings", getUserRatings);
router.get("/:username/profile", getUserProfile);
router.get("/:username/complete", getUserComplete);
router.get("/", getAllUsers);
router.get("/:username/films", getFilmsByUser);

export default router;
