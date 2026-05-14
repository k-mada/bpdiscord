// Types shared between client and server.
//
// Anything in here must be free of side-specific dependencies (no React, no
// Express, no Supabase server SDK, no Drizzle, no Puppeteer). If a type needs
// one of those, it belongs in src/client/types.ts or src/server/types.ts.

// ===========================
// API Response
// ===========================

export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
  error?: string;
  count?: number;
  // Loosely-typed because controllers use it as an array of validation errors,
  // a partial-failure object, or a debug string depending on the endpoint.
  details?: unknown;
}

// ===========================
// User & Authentication
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

// `email` is optional to match what Supabase's auth User actually returns —
// password-flow users always have one, but the SDK types it as optional.
// Client code that needs email-required can narrow via StoredUser (see
// src/client/types.ts) or the isValidStoredUser guard.
export interface AuthenticatedUser {
  id: string;
  email?: string;
  user_metadata?: {
    name?: string;
  };
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
}

export interface AuthResponse {
  message: string;
  access_token?: string;
  user: AuthenticatedUser;
}

// ===========================
// Password Reset
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
// Scraper
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
