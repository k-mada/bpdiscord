// Cross-cutting API/contract types (ApiResponse, User, AuthRequest,
// SignupRequest, AuthResponse, PasswordResetRequest,
// PasswordResetConfirmRequest, ScraperRequest, AuthenticatedUser) live in
// src/shared/types.ts. Import from there directly.

import type { AuthenticatedUser } from "../shared/types";

// ===========================
// UI Data Shapes
// ===========================

export interface LBFilm {
  film_slug: string;
  title: string;
  watch_count: number;
  rating_count: number;
  average_rating: number;
  poster: string;
  banner: string;
  tmdb_link: string;
  url: string;
}

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
// Client-side Stored Auth
// ===========================

export interface StoredUser extends AuthenticatedUser {
  // Re-required: a stored (logged-in) user always has an email — the
  // isValidStoredUser guard below enforces this at runtime.
  email: string;
  aud: string;
  role?: string;
}

// Type guard for user validation
export const isValidStoredUser = (obj: unknown): obj is StoredUser => {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "id" in obj &&
    "email" in obj &&
    typeof (obj as StoredUser).id === "string" &&
    typeof (obj as StoredUser).email === "string"
  );
};

// ===========================
// Movie Comparison
// ===========================

export interface MovieInCommon {
  title: string;
  film_slug: string;
  user1_rating: number;
  user2_rating: number;
  poster: string | null;
  year: number | null;
  letterboxd_url: string | null;
  // Count of distinct users in the DB who have rated this film (rating > 0).
  // Used as a "distinctiveness" tiebreaker in findSharedDarling /
  // findBiggestFight — lower = more distinctive to this pair.
  total_ratings: number;
}

export interface MoviesInCommonData {
  user1: string;
  user2: string;
  moviesInCommon: MovieInCommon[];
  count: number;
  averageRatingDifference?: number;
  correlationCoefficient?: number;
}

// ===========================
// MFL Types
// ===========================
export interface MFLScoringMetric {
  metricId: number;
  metric: string;
  metricName: string;
  category: string;
  scoringCondition: string;
  pointValue: number;
}

export interface MFLMovieScore {
  scoringId: number;
  filmSlug: string;
  metricId: number;
  pointsAwarded: number;
  category: string;
  metric: string;
  metricName: string;
  scoringCondition: string;
}

// ===========================
// Component Props Types
// ===========================

export interface RatingDistributionHistogramProps {
  distribution: Rating[];
  className?: string;
  showTooltips?: boolean;
}

export interface TooltipProps {
  content: string;
  children: React.ReactNode;
  position?: "top" | "bottom" | "left" | "right";
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
// Award Show Types
// ===========================

export interface AwardShow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

// ===========================
// Event Types
// ===========================

export interface EventNominee {
  id: string;
  categoryId: string;
  personName: string | null;
  movieOrShowName: string;
  isWinner: boolean;
}

export interface EventUserPick {
  id: string;
  categoryId: string;
  userId: string;
  nomineeId: string;
}

export interface EventCategory {
  id: string;
  eventId: string;
  name: string;
  displayOrder: number;
  displayMode: "movie_first" | "person_first";
  nominees: EventNominee[];
}

export interface EventData {
  id: string;
  name: string;
  slug: string;
  year: number;
  editionNumber: number | null;
  nominationsDate: string | null;
  awardsDate: string | null;
  status: "active" | "inactive";
  awardShowId: string;
  awardShowName: string;
  awardShowSlug: string;
  categories: EventCategory[];
}

export interface EventSummary {
  id: string;
  name: string;
  slug: string;
  year: number;
  editionNumber: number | null;
  nominationsDate: string | null;
  awardsDate: string | null;
  status: "active" | "inactive";
  awardShowId: string;
  awardShowName: string;
  awardShowSlug: string;
}

// ===========================
// Oscars Types
// ===========================

export interface OscarsPrediction {
  title: string;
  subtitle: string;
}

export interface OscarsCategory {
  order: number;
  category: string;
  nominees: OscarsPrediction[];
  pick_sean: OscarsPrediction;
  pick_amanda: OscarsPrediction;
  pick_sean_should_win: OscarsPrediction;
  pick_amanda_should_win: OscarsPrediction;
  winner: string;
  actual_winner: OscarsPrediction[];
}

export type OscarsViewMode = "will_win" | "should_win";

// ===========================
// Refresh Job (admin: /api/admin/refresh-rankings)
// ===========================

export type RefreshJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

export type RefreshJobPhase = "user_scrape" | "missing_films" | "film_ratings";

export interface RefreshJobProgress {
  user_scrape?: {
    processed: number;
    total: number;
    current?: string | null;
    films_added?: number;
  };
  missing_films?: {
    count: number;
  };
  film_ratings?: {
    processed: number;
    total: number;
    current?: string | null;
  };
}

export interface RefreshJobErrorEntry {
  phase: string;
  item: string | null;
  error: string;
  at: string;
}

// Note on casing: top-level fields are camelCase because Drizzle (server-side
// ORM) returns rows with JS-property names from src/server/db/schema.ts. Only
// the underlying DB columns + jsonb contents are snake_case (those are written
// by moviemaestro's Python supabase-py client, which uses raw column names).
export interface RefreshJob {
  id: string;
  status: RefreshJobStatus;
  startedAt: string;
  finishedAt: string | null;
  startedBy: string;
  phase: RefreshJobPhase | null;
  progress: RefreshJobProgress;
  errors: RefreshJobErrorEntry[];
  logTail: string;
  updatedAt: string;
}

// user_scrape_jobs row — same shape as refresh_jobs plus the target
// Letterboxd username. Both tables drive the same 3-phase pipeline; the
// per-user variant just scopes phase 1 + phase 2 to one user.
export interface UserScrapeJob extends RefreshJob {
  lbusername: string;
}

// ===========================
// Admin: account management (GET/PUT/DELETE /api/admin/users)
// ===========================

// Merged shape returned by GET /api/admin/users — auth.users (email, name)
// joined with app_users (lbusername, timestamps) by id. See server-side
// userAdminController.mergeAccount for the canonical mapping.
export interface AccountView {
  id: string;
  email: string | null;
  name: string | null;
  lbusername: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// PUT /api/admin/users/:id request body. Each field is optional — omit to
// leave unchanged. `lbusername: null` explicitly unlinks. Server enforces
// the Letterboxd.com username format on non-null values.
export interface AccountUpdateRequest {
  email?: string;
  name?: string;
  lbusername?: string | null;
}

// PUT response — same as AccountView, plus `requiresReauth: true` when an
// admin updates their own email (their JWT rotated server-side).
export interface AccountUpdateResponse extends AccountView {
  requiresReauth?: boolean;
}

export interface CompatibilityExtreme {
  username: string;
  displayName: string | null;
  pearson: number;
  sampleSize: number;
  mad: number;
}

export interface CompatibilityExtremesData {
  mostCompatible: CompatibilityExtreme[];
  leastCompatible: CompatibilityExtreme[];
}

// GET /api/auth/me — the authenticated account's identity, joined with its
// linked Letterboxd profile. `lbusername` is null when the account hasn't
// claimed a Letterboxd username.
export interface CurrentUser {
  id: string;
  email: string | null;
  role: string | null;
  lbusername: string | null;
  displayName: string | null;
}

// Aggregated profile + rating distribution (GET /api/film-users/:username/complete).
export interface FilmUserComplete {
  username: string;
  displayName: string | null;
  followers: number;
  following: number;
  numberOfLists: number;
  totalRatings: number;
  ratings: Array<{ rating: number; count: number }>;
  source: string;
  success: boolean;
}
