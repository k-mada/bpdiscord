import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import mflRoutes from "./routes/mflRoutes";
import scraperRoutes from "./routes/scraperRoutes";
import comparisonRoutes from "./routes/comparisonRoutes";
import filmUserRoutes from "./routes/filmUserRoutes";
import statsRoutes from "./routes/statsRoutes";
import cronRoutes from "./routes/cronRoutes";
import { globalErrorHandler } from "./middleware/errorHandler";
import { ApiResponse } from "./types";

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
    callback: (err: Error | null, allow?: boolean) => void
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
        pattern.test(origin)
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

// Custom timeout middleware for scraper routes
const scraperTimeout = (req: Request, res: Response, next: any) => {
  // Only apply extended timeout for scraper routes
  if (req.path.startsWith("/api/scraper")) {
    // Set 15 minute timeout for scraper operations
    req.setTimeout(15 * 60 * 1000); // 15 minutes
    res.setTimeout(15 * 60 * 1000); // 15 minutes
  }
  next();
};

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

// Apply timeout middleware before routes
app.use(scraperTimeout);

// Routes
app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/comparison", comparisonRoutes);
app.use("/api/film-users", filmUserRoutes);
app.use("/api/stats", statsRoutes);
app.use("/api/cron", cronRoutes);
app.use("/api/mfl", mflRoutes);

// Only load scraper routes in development or when explicitly enabled
if (
  // process.env.NODE_ENV !== "production" ||
  process.env.ENABLE_SCRAPER === "true"
) {
  app.use("/api/scraper", scraperRoutes);
} else {
  // Return 503 for scraper endpoints in production
  app.use("/api/scraper", (req, res) => {
    res.status(503).json({
      error: "Scraping functionality disabled in production",
      message: "Use the database-first endpoints at /api/film-users instead",
    });
  });
}

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
    `🚀 Secure TypeScript server running on http://localhost:${PORT}`
  );
  console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || "development"}`);
});

export default app;
