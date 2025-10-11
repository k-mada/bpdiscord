import { SupabaseClient } from "@supabase/supabase-js";

// ===========================
// API Response Types
// ===========================

export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
  count?: number;
  details?: any[];
}

// ===========================
// User & Authentication Types
// ===========================

export interface User {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface AuthRequest {
  email: string;
  password: string;
}

export interface SignupRequest extends AuthRequest {
  name: string;
}

export interface AuthResponse {
  message: string;
  access_token?: string;
  user: any;
}

export interface CreateUserRequest {
  name: string;
  email: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
}

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
// Password Reset Types
// ===========================

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  email?: string;
  password: string;
  token?: string;
}

// ===========================
// Scraper Types
// ===========================

export interface ScraperRequest {
  url: string;
  selectors: Array<{
    name: string;
    css: string;
    attributes?: string[];
    multiple?: boolean;
  }>;
}

export interface ScraperSelector {
  name: string;
  css: string;
  attributes?: string[];
  multiple?: boolean;
  getInnerText?: (element: Element) => string;
}

// ===========================
// Database Types
// ===========================

export interface UserProfileData {
  displayName: string;
  followers: number;
  following: number;
  numberOfLists: number;
}

export interface RatingData {
  rating: number;
  count: number;
}

export interface UserRatingsData {
  username: string;
  displayName?: string;
  followers?: number;
  following?: number;
  numberOfLists?: number;
  totalRatings?: number;
  ratings: RatingData[];
}

export interface UserFilm {
  film_slug: string;
  title: string;
  rating: number;
  liked: boolean;
}

export interface LBFilm {
  film_slug: string;
  rating: number;
  rating_count: number;
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
      JWT_SECRET: string;
      PORT?: string;
      NODE_ENV?: "development" | "production" | "test";
      FRONTEND_URL?: string;
      VERCEL_URL?: string;
      ENABLE_SCRAPER?: string;
      PUPPETEER_SKIP_CHROMIUM_DOWNLOAD?: string;
    }
  }
}
