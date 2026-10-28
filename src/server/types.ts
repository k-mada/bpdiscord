import { SupabaseClient } from "@supabase/supabase-js";

// Cross-cutting API/contract types live in src/shared/types.ts.

export interface CreateUserRequest {
  name: string;
  email: string;
}

export interface UpdateUserRequest {
  name?: string;
  email?: string;
}

export type Role = "admin" | "editor" | "member";

export interface SupabaseUser {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
  };
  // Authoritative role claim. Only the service-role key can write it, so a
  // user cannot self-promote the way they could with user_metadata.
  app_metadata?: {
    role?: Role;
  };
  created_at: string;
  updated_at?: string;
}

export interface AuthenticatedRequest extends Express.Request {
  user: SupabaseUser;
  supabase: SupabaseClient;
}

// For extending Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: SupabaseUser;
      supabase?: SupabaseClient;
    }
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
      TMDB_READ_API_TOKEN?: string;
      WORKER_URL?: string;
      WORKER_SHARED_SECRET?: string;
    }
  }
}
