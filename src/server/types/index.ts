import { SupabaseClient } from '@supabase/supabase-js';

// Re-export shared types
export {
  User,
  AuthRequest,
  SignupRequest,
  AuthResponse,
  ApiResponse,
  PasswordResetRequest,
  PasswordResetConfirmRequest,
  ScraperRequest,
} from '../../shared/types';

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
    role?: 'admin' | 'user';
  };
  created_at: string;
  updated_at?: string;
}

export interface AuthenticatedRequest extends Express.Request {
  user: SupabaseUser;
  supabase: SupabaseClient;
}

// Scraper types
export interface ScraperSelector {
  name: string;
  css: string;
  attributes?: string[];
  multiple?: boolean;
  getInnerText?: (element: Element) => string;
}

export interface ScraperSelector {
  name: string;
  css: string;
  attributes?: string[];
  multiple?: boolean;
  getInnerText?: (element: Element) => string;
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

// DOM types for Puppeteer
declare global {
  interface Element {
    innerText: string;
  }
}

