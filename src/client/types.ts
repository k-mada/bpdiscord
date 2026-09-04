// Cross-cutting API/contract types live in src/shared/types.ts.

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

export interface HaterRanking2 {
  displayName: string;
  username: string;
  filmsRated: number;
  differential: number;
  adjustedDifferential: number;
}

export interface UserComparisonData {
  user1: UserData;
  user2: UserData;
}

export interface MovieInCommon {
  title: string;
  film_slug: string;
  user1_rating: number;
  user2_rating: number;
  poster: string | null;
  year: number | null;
  letterboxd_url: string | null;
  // Distinctiveness tiebreaker for findSharedDarling / findBiggestFight —
  // lower means more distinctive to this pair.
  total_ratings: number;
}

export interface TasteCompatibility {
  // Pearson correlation over the both-rated set. null when either user has
  // zero rating variance (Pearson undefined) or the shared set is empty.
  pearson: number | null;
  // Mean absolute star difference over the both-rated set. null when empty.
  mad: number | null;
  sampleSize: number;
}

export interface MoviesInCommonData {
  user1: string;
  user2: string;
  moviesInCommon: MovieInCommon[];
  count: number;
  compatibility: TasteCompatibility;
}

export interface MFLScoringMetric {
  metricId: number;
  metric: string;
  metricName: string;
  category: string;
  scoringCondition: string;
  pointValue: number;
}

export interface MFLCatalogueFilm {
  title: string;
  filmSlug: string;
  releaseDate: string | null;
  price: number | null;
  totalPoints: number;
  /** Keyed by MFLScoringMetrics.category; an unscored film has no keys. */
  pointsByCategory: Record<string, number>;
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

export interface AwardShow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

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

// Tags an error[] entry as a transient, retry-worthy Letterboxd IP/rate block.
// Producer of record: moviemaestro app/pipeline/job_state.py::fail_blocked.
export const LETTERBOXD_BLOCKED_REASON = "letterboxd_blocked";

export interface RefreshJobErrorEntry {
  phase: string;
  item: string | null;
  error: string;
  at: string;
  reason?: typeof LETTERBOXD_BLOCKED_REASON;
}

// Top-level fields are camelCase because Drizzle returns JS property names;
// only the jsonb contents stay snake_case (written by moviemaestro).
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

// Same 3-phase pipeline as refresh_jobs, scoped to one Letterboxd user.
export interface UserScrapeJob extends RefreshJob {
  lbusername: string;
}

// GET /api/admin/users — auth.users joined with app_users by id. Canonical
// mapping lives in userAdminController.mergeAccount.
export interface AccountView {
  id: string;
  email: string | null;
  name: string | null;
  lbusername: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

// PUT /api/admin/users/:id — omit a field to leave it unchanged;
// `lbusername: null` explicitly unlinks.
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

// GET /api/auth/me — `lbusername` is null when the account hasn't claimed a
// Letterboxd username.
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
  totalWatched: number;
  ratings: Array<{ rating: number; count: number }>;
  source: string;
  success: boolean;
}
