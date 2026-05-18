import { Router } from "express";

import { authenticateToken, authorizeAdmin } from "../middleware/auth";
import { handleValidationErrors } from "../middleware/errorHandler";
import { validateUUIDParam } from "../middleware/validation";
import { UserAdminController } from "../controllers/userAdminController";

const router = Router();

// Every route in this router requires a valid JWT and an admin role
// (user_metadata.role === 'admin' set in Supabase). Mirrors adminRoutes.ts.
router.use(authenticateToken, authorizeAdmin);

router.get("/", UserAdminController.list);

router.put(
  "/:id",
  ...validateUUIDParam,
  handleValidationErrors,
  UserAdminController.update,
);

router.delete(
  "/:id",
  ...validateUUIDParam,
  handleValidationErrors,
  UserAdminController.remove,
);

export default router;
