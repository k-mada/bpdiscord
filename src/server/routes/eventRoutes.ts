import { Router } from "express";
import { authenticateToken } from "../middleware/auth";
import {
  getEvents,
  getEventBySlug,
  submitPick,
  getMyPicks,
  createEvent,
  updateEvent,
  upsertCategory,
  deleteCategory,
  upsertNominee,
  deleteNominee,
  setWinner,
} from "../controllers/eventController";

const router = Router();

// Public
router.get("/", getEvents);
router.get("/:slug", getEventBySlug);

// Authenticated (any logged-in user)
router.post("/picks", authenticateToken, submitPick);
router.get("/:slug/my-picks", authenticateToken, getMyPicks);

// Admin (authenticateToken + admin check in controller)
router.post("/admin/events", authenticateToken, createEvent);
router.put("/admin/events/:id", authenticateToken, updateEvent);
router.post("/admin/categories", authenticateToken, upsertCategory);
router.delete("/admin/categories/:id", authenticateToken, deleteCategory);
router.post("/admin/nominees", authenticateToken, upsertNominee);
router.delete("/admin/nominees/:id", authenticateToken, deleteNominee);
router.put("/admin/nominees/:id/winner", authenticateToken, setWinner);

export default router;
