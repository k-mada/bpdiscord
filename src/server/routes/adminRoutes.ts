import { Router } from "express";

import { authenticateToken, authorizeAdmin } from "../middleware/auth";
import { handleValidationErrors } from "../middleware/errorHandler";
import { validateUUIDParam } from "../middleware/validation";
import {
  cancelRefreshJob,
  getRefreshJob,
  triggerRefresh,
} from "../controllers/refreshJobController";

const router = Router();

// Every admin route requires a valid JWT and an admin role
// (user_metadata.role === 'admin' set in Supabase).
router.use(authenticateToken, authorizeAdmin);

router.post("/refresh-rankings", triggerRefresh);

router.get(
  "/refresh-rankings/:id",
  ...validateUUIDParam,
  handleValidationErrors,
  getRefreshJob,
);

router.post(
  "/refresh-rankings/:id/cancel",
  ...validateUUIDParam,
  handleValidationErrors,
  cancelRefreshJob,
);

export default router;
