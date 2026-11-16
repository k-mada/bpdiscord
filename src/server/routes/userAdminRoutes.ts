import { Router } from "express";

import { authenticateToken, authorizeAdmin } from "../middleware/auth";
import { handleValidationErrors } from "../middleware/errorHandler";
import { validateLbusernameParam, validateUUIDParam } from "../middleware/validation";
import { UserAdminController } from "../controllers/userAdminController";

const router = Router();

// Every route in this router requires a valid JWT and an admin role
// (app_metadata.role === 'admin' set in Supabase). Mirrors adminRoutes.ts.
router.use(authenticateToken, authorizeAdmin);

router.get("/", UserAdminController.list);

router.post("/profiles", UserAdminController.createProfile);

router.put(
  "/profiles/:lbusername",
  ...validateLbusernameParam,
  handleValidationErrors,
  UserAdminController.updateProfile,
);

router.delete(
  "/profiles/:lbusername",
  ...validateLbusernameParam,
  handleValidationErrors,
  UserAdminController.removeProfile,
);

router.put(
  "/:id",
  ...validateUUIDParam,
  handleValidationErrors,
  UserAdminController.update,
);

router.delete(
  "/by-lbusername/:lbusername",
  ...validateLbusernameParam,
  handleValidationErrors,
  UserAdminController.removeByLbusername,
);

router.delete(
  "/:id",
  ...validateUUIDParam,
  handleValidationErrors,
  UserAdminController.remove,
);

export default router;
