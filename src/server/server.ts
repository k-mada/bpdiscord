import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes";
import userAdminRoutes from "./routes/userAdminRoutes";
import mflRoutes from "./routes/mflRoutes";
import comparisonRoutes from "./routes/comparisonRoutes";
import filmUserRoutes from "./routes/filmUserRoutes";
import statsRoutes from "./routes/statsRoutes";
import eventRoutes from "./routes/eventRoutes";
import graphRoutes from "./routes/graphRoutes";
import adminRoutes from "./routes/adminRoutes";
import scrapeUserRoutes from "./routes/scrapeUserRoutes";
import { globalErrorHandler } from "./middleware/errorHandler";
import { ApiResponse } from "../shared/types";

// Load environment variables
// In production, environment variables should be set via system environment
// or deployment platform (Heroku, Vercel, etc.)
if (process.env.NODE_ENV !== "production") {
  dotenv.config();
}

const app = express();
const PORT: number = parseInt(process.env.PORT || "3001", 10);

// Security middleware
app.use(helmet());
// CORS configuration with dynamic origin handling
const corsOptions = {
  origin: (
    origin: string | undefined,
    callback: (err: Error | null, allow?: boolean) => void,
  ) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin) {
      return callback(null, true);
    }

    if (process.env.NODE_ENV === "production") {
      // Build allowed origins list
      const allowedOrigins = [];

      // Add custom frontend URL if set
      if (process.env.FRONTEND_URL) {
        allowedOrigins.push(process.env.FRONTEND_URL);
      }

      // Add Vercel URL if available (Vercel automatically sets this)
      if (process.env.VERCEL_URL) {
        allowedOrigins.push(`https://${process.env.VERCEL_URL}`);
      }

      // Regex patterns for Vercel domains
      const allowedPatterns = [
        /^https:\/\/.*\.vercel\.app$/,
        /^https:\/\/bpdiscord.*\.vercel\.app$/,
        /^https:\/\/.*-k-madas-projects\.vercel\.app$/,
        // Add your custom domain when you get one:
        // /^https:\/\/yourdomain\.com$/,
      ];

      // Check exact matches first, then patterns
      const exactMatch = allowedOrigins.includes(origin);
      const patternMatch = allowedPatterns.some((pattern) =>
        pattern.test(origin),
      );
      const isAllowed = exactMatch || patternMatch;

      // Debug logging for CORS issues
      if (!isAllowed) {
        console.warn(`CORS blocked origin: ${origin}`);
        console.warn(`Allowed origins:`, allowedOrigins);
        console.warn(`VERCEL_URL:`, process.env.VERCEL_URL);
      }

      return callback(null, isAllowed);
    } else {
      // Development: allow localhost
      const allowedOrigins = [
        "http://localhost:3000", // Original CRA port
        "http://localhost:3001", // Server port
        "http://localhost:5173", // Vite dev server port
        "http://localhost:5174", // Vite dev server fallback port
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
      ];
      return callback(null, allowedOrigins.includes(origin));
    }
  },
  credentials: true,
};

app.set("trust proxy", 1); //

app.use(cors(corsOptions));

// Rate limiting
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, //  minutes
  max: 500, // Limit each IP to 500 requests per windowMs
  message: { error: "Too many requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/", limiter);
app.use(express.json({ limit: "10mb" }));

// Health check endpoint
app.get("/api/health", (req: Request, res: Response): void => {
  const response: ApiResponse = {
    message: "Server is running!",
    data: {
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
    },
  };
  res.json(response);
});

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/admin/users", userAdminRoutes);
app.use("/api/comparison", comparisonRoutes);
app.use("/api/film-users", filmUserRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/mfl", mflRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/actor-graph", graphRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/scrape-user", scrapeUserRoutes);

// Error handling middleware
app.use(globalErrorHandler);

// 404 handler
app.use((req: Request, res: Response): void => {
  const response: ApiResponse = { error: "Route not found" };
  res.status(404).json(response);
});

// Start server
app.listen(PORT, (): void => {
  console.log(
    `🚀 Secure TypeScript server running on http://localhost:${PORT}`,
  );
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
