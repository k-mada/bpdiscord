import express, { Request, Response } from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import dotenv from "dotenv";

import authRoutes from "./routes/authRoutes";
import userRoutes from "./routes/userRoutes";
import scraperRoutes from "./routes/scraperRoutes";
import comparisonRoutes from "./routes/comparisonRoutes";
import filmUserRoutes from "./routes/filmUserRoutes";
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
app.use(
  cors({
    origin:
      process.env.NODE_ENV === "production"
        ? ["https://yourdomain.com"] // Replace with your frontend URL
        : ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
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
app.use("/api/users", userRoutes);
app.use("/api/scraper", scraperRoutes);
app.use("/api/comparison", comparisonRoutes);
app.use("/api/film-users", filmUserRoutes);

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
