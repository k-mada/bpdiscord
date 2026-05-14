import { SupabaseClient } from "@supabase/supabase-js";

// Cross-cutting API/contract types (ApiResponse, User, AuthRequest,
// SignupRequest, AuthResponse, PasswordResetRequest,
// PasswordResetConfirmRequest, ScraperRequest, AuthenticatedUser) live in
// src/shared/types.ts. Import from there directly.

// ===========================
// Server-side User Mutations
// ===========================

export interface CreateUserRequest {
  name: string;
  email: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
}

// ===========================
// Supabase Auth
// ===========================

export interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
    role?: "admin" | "user";
  };
  created_at: string;
  updated_at?: string;
}

export interface AuthenticatedRequest extends Express.Request {
  user: SupabaseUser;
  supabase: SupabaseClient;
}

// ===========================
// Scraper
// ===========================

export interface ScraperSelector {
  name: string;
  css: string;
  attributes?: string[];
  multiple?: boolean;
  getInnerText?: (element: Element) => string;
}

// ===========================
// Letterboxd Scraping Shapes
// ===========================

export interface UserProfileData {
  displayName: string;
  followers: number;
  following: number;
  numberOfLists: number;
}

export interface UserFilm {
  film_slug: string;
  title: string;
  rating: number;
  liked: boolean;
}

// ===========================
// Global Type Extensions
// ===========================

// For extending Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: SupabaseUser;
      supabase?: SupabaseClient;
    }
  }
}

// DOM types for Puppeteer
declare global {
  interface Element {
    innerText: string;
  }
}

// Environment variables
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      SUPABASE_URL: string;
      SUPABASE_ANON_KEY: string;
      SUPABASE_SERVICE_ROLE_KEY: string;
      DATABASE_URL: string;
      JWT_SECRET: string;
      PORT?: string;
      NODE_ENV?: "development" | "production" | "test";
      FRONTEND_URL?: string;
      VERCEL_URL?: string;
      ENABLE_SCRAPER?: string;
      PUPPETEER_SKIP_CHROMIUM_DOWNLOAD?: string;
      TMDB_READ_API_TOKEN?: string;
    }
  }
}
