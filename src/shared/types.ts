// Must stay free of side-specific dependencies (React, Express, Drizzle, the
// server SDK). Anything needing those goes in client/types.ts or server/types.ts.

export interface ApiResponse<T = unknown> {
  data?: T;
  message?: string;
  error?: string;
  count?: number;
  // Loosely-typed because controllers use it as an array of validation errors,
  // a partial-failure object, or a debug string depending on the endpoint.
  details?: unknown;
}

// Not LBFilm: that type has no per-user rating (the sort key). Kept minimal;
// adding fields later is backward-compatible.
export interface SwapFilm {
  film_slug: string;
  title: string;
  user_rating: number | null; // null = watched but not rated; sorts last
}

export interface MovieSwapResult {
  recsForUserA: SwapFilm[]; // films userA hasn't seen that userB has
  recsForUserB: SwapFilm[]; // films userB hasn't seen that userA has
}

export interface FilmRater {
  username: string;
  displayName: string | null;
  rating: number;
  liked: boolean;
}

// GET /api/films/:filmSlug — Discord-scoped unless includeNonDiscord is set.
// `ratings` holds raters only, so watchedCount >= ratings.length.
export interface FilmDetail {
  filmSlug: string;
  title: string;
  releaseYear: number | null;
  poster: string | null;
  letterboxdUrl: string | null;
  letterboxdRating: number | null;
  watchedCount: number;
  ratedCount: number;
  averageRating: number | null;
  ratings: FilmRater[];
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
  lbusername?: string;
}

// `email` is optional only because the Supabase SDK types it that way;
// password-flow users always have one. Narrow via StoredUser when required.
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

export interface PasswordResetRequest {
  email: string;
}
