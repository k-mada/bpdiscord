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
// Scraper Types (for API calls)
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

// ===========================
// UI Component Types
// ===========================

export interface Rating {
  rating: number;
  count: number;
}

export interface UserData {
  username: string;
  displayName?: string;
  followers?: number;
  following?: number;
  numberOfLists?: number;
  totalFilms?: number;
  totalRatings?: number;
  ratings: Rating[];
}

export interface HaterRanking {
  username: string;
  displayName?: string;
  averageRating: number;
  totalRatings: number;
  ratingDistribution?: Rating[];
}

export interface UserComparisonData {
  user1: UserData;
  user2: UserData;
}

// ===========================
// Component Props Types
// ===========================

export interface DashboardProps {
  onLogout: () => void;
}

export interface ScraperInterfaceProps {
  token: string;
}

export interface UserComparisonProps {
  onBackToProfile: () => void;
}

export interface HaterRankingsProps {
  onBackToProfile?: () => void;
  isPublic?: boolean;
}

export interface LoginPageProps {
  onLogin: (token: string) => void;
}

// ===========================
// API Service Types
// ===========================

export interface FilmUserApiResponse {
  username: string;
  displayName?: string;
  followers?: number;
  following?: number;
  numberOfLists?: number;
  totalRatings?: number;
  ratings: Rating[];
  source: 'database' | 'scraped' | 'scraped_fallback' | 'mixed_fallback';
  success: boolean;
}