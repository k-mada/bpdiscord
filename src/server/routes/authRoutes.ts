import { Router } from "express";
import rateLimit from "express-rate-limit";
import { AuthController } from "../controllers/authController";
import { validateSignup, validateAuth } from "../middleware/validation";
import { handleValidationErrors } from "../middleware/errorHandler";
import { authenticateToken } from "../middleware/auth";

// Rate limiter for password reset requests
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Allow 3 password reset requests per 15 minutes
  message: {
    error: "Too many password reset requests, please try again later.",
  },
});

const router = Router();

const strictLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: {
    error: "Too many authentication requests, please try again later.",
  },
});

router.post(
  "/signup",
  [strictLimiter, ...validateSignup, handleValidationErrors],
  AuthController.signup
);

router.post(
  "/login",
  [strictLimiter, ...validateAuth, handleValidationErrors],
  AuthController.login
);

router.post(
  "/forgot-password",
  [passwordResetLimiter, handleValidationErrors],
  AuthController.requestPasswordReset
);

router.get("/me", authenticateToken, AuthController.me);

export default router;
