import { Router } from "express";
import { authenticateToken, authorizeAdmin } from "../middleware/auth";
import { validateUUIDParam } from "../middleware/validation";
import { handleValidationErrors } from "../middleware/errorHandler";
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

// Admin (authenticateToken verifies JWT, authorizeAdmin checks role, validateUUIDParam validates :id)
router.post("/admin/events", authenticateToken, authorizeAdmin, createEvent);
router.put("/admin/events/:id", authenticateToken, authorizeAdmin, ...validateUUIDParam, handleValidationErrors, updateEvent);
router.post("/admin/categories", authenticateToken, authorizeAdmin, upsertCategory);
router.delete("/admin/categories/:id", authenticateToken, authorizeAdmin, ...validateUUIDParam, handleValidationErrors, deleteCategory);
router.post("/admin/nominees", authenticateToken, authorizeAdmin, upsertNominee);
router.delete("/admin/nominees/:id", authenticateToken, authorizeAdmin, ...validateUUIDParam, handleValidationErrors, deleteNominee);
router.put("/admin/nominees/:id/winner", authenticateToken, authorizeAdmin, ...validateUUIDParam, handleValidationErrors, setWinner);

export default router;
