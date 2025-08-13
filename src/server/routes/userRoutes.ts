import { Router } from "express";
import rateLimit from "express-rate-limit";
import { UserController } from "../controllers/userController";
import { authenticateToken, authorizeOwnerOrAdmin } from "../middleware/auth";
import {
  validateUser,
  validateUserUpdate,
  validateUserId,
} from "../middleware/validation";
import { handleValidationErrors } from "../middleware/errorHandler";

const router = Router();

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many write requests, please try again later." },
});

// Apply authentication to all user routes
router.use(authenticateToken);

// User routes
router.post(
  "/",
  [strictLimiter, ...validateUser, handleValidationErrors],
  UserController.createUser
);

router.get("/", UserController.getAllUsers);

router.get("/me", UserController.getMyProfile);

router.get(
  "/:id",
  [...validateUserId, handleValidationErrors, authorizeOwnerOrAdmin],
  UserController.getUserById
);

router.put(
  "/:id",
  [
    strictLimiter,
    ...validateUserId,
    ...validateUserUpdate,
    handleValidationErrors,
    authorizeOwnerOrAdmin,
  ],
  UserController.updateUser
);

router.delete(
  "/:id",
  [
    strictLimiter,
    ...validateUserId,
    handleValidationErrors,
    authorizeOwnerOrAdmin,
  ],
  UserController.deleteUser
);

export default router;
