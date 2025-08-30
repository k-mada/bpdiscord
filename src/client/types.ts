// ===========================
// API Response Types
// ===========================

export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
  error?: string;
  count?: number;
  details?: unknown[];
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
  user: AuthenticatedUser;
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
// Authentication & User Types (Enhanced)
// ===========================

export interface AuthenticatedUser {
  id: string;
  email: string;
  user_metadata?: {
    name?: string;
  };
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
}

export interface StoredUser extends AuthenticatedUser {
  aud: string;
  role?: string;
}

// Type guard for user validation
export const isValidStoredUser = (obj: unknown): obj is StoredUser => {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'id' in obj &&
    'email' in obj &&
    typeof (obj as StoredUser).id === 'string' &&
    typeof (obj as StoredUser).email === 'string'
  );
};

// ===========================
// Movie & Rating Types (Enhanced)
// ===========================

export interface MovieInCommon {
  title: string;
  user1_rating: number;
  user2_rating: number;
  year?: number;
  letterboxd_url?: string;
}

export interface MoviesInCommonData {
  user1: string;
  user2: string;
  moviesInCommon: MovieInCommon[];
  count: number;
  averageRatingDifference?: number;
  correlationCoefficient?: number;
}

export interface TasteCompatibility {
  score: number;
  description: string;
  commonMovies: number;
  averageRatingDifference: number;
}

// ===========================
// API Response Types (Specific)
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

export interface UserRatingsResponse {
  username: string;
  ratings: Rating[];
  totalRatings: number;
  averageRating?: number;
  source: string;
}

export interface HaterRankingsResponse {
  rankings: HaterRanking[];
  totalUsers: number;
  lastUpdated?: string;
}

export interface ComparisonResponse {
  user1: UserData;
  user2: UserData;
  moviesInCommon?: MoviesInCommonData;
  tasteCompatibility?: TasteCompatibility;
}

// ===========================
// Component Props Types
// ===========================

export interface RatingDistributionHistogramProps {
  distribution: Rating[];
  className?: string;
  showTooltips?: boolean;
}

export interface TasteCompatibilityProps {
  user1Data: UserData;
  user2Data: UserData;
  moviesInCommonData: MoviesInCommonData | null;
  className?: string;
}

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredAuth?: boolean;
}

export interface HaterRankingsProps {
  onBackToProfile?: () => void;
  isPublic?: boolean;
}

// ===========================
// Hook Return Types
// ===========================

export interface UseAuthReturn {
  user: StoredUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: AuthRequest) => Promise<void>;
  signup: (userData: SignupRequest) => Promise<void>;
  logout: () => void;
  error: string | null;
}

export interface UseApiReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: () => Promise<void>;
  reset: () => void;
}

export interface UseLocalStorageReturn<T> {
  value: T | null;
  setValue: (value: T | null) => void;
  removeValue: () => void;
  error: string | null;
}

// ===========================
// Error Types
// ===========================

export interface AppError {
  message: string;
  code?: string | number;
  details?: unknown;
  timestamp: Date;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

// ===========================
// Form Types
// ===========================

export interface FormState {
  isSubmitting: boolean;
  errors: Record<string, string>;
  touched: Record<string, boolean>;
}

export interface LoginFormData {
  email: string;
  password: string;
}

export interface SignupFormData extends LoginFormData {
  name: string;
  confirmPassword?: string;
}

// ===========================
// Constants & Enums
// ===========================

export const RATING_VALUES = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5] as const;
export type RatingValue = typeof RATING_VALUES[number];

export enum LoadingState {
  IDLE = 'idle',
  LOADING = 'loading',
  SUCCESS = 'success',
  ERROR = 'error'
}

export enum AuthStatus {
  AUTHENTICATED = 'authenticated',
  UNAUTHENTICATED = 'unauthenticated',
  LOADING = 'loading'
}