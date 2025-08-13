// Shared types for both server and client

export interface ApiResponse<T = any> {
  data?: T;
  message?: string;
  error?: string;
  count?: number;
  details?: any[];
}

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

// Password reset types
export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirmRequest {
  email?: string;
  password: string;
  token?: string;
}

// Scraper types
export interface ScraperRequest {
  url: string;
  selectors: Array<{
    name: string;
    css: string;
    attributes?: string[];
    multiple?: boolean;
  }>;
} 