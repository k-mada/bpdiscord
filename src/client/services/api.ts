import {
  ApiResponse,
  User,
  AuthRequest,
  SignupRequest,
  AuthResponse,
  ScraperRequest,
  PasswordResetConfirmRequest,
  MFLScoringMetric,
  MFLMovieScore,
  AwardShow,
  EventSummary,
  EventData,
  EventUserPick,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const { headers: optionHeaders, ...restOptions } = options;
    const config: RequestInit = {
      ...restOptions,
      headers: {
        "Content-Type": "application/json",
        ...optionHeaders,
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || `Request failed with status ${response.status}`,
        );
      }

      return data;
    } catch (error) {
      console.error("API request failed:", error);
      throw error;
    }
  }

  // Auth endpoints
  async signup(userData: SignupRequest): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify(userData),
    });
  }

  async login(credentials: AuthRequest): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(credentials),
    });
  }

  async requestPasswordReset(email: string): Promise<ApiResponse> {
    return this.request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    });
  }

  async confirmPasswordReset(
    data: PasswordResetConfirmRequest,
  ): Promise<ApiResponse<AuthResponse>> {
    return this.request<AuthResponse>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(data),
    });
  }

  // User endpoints
  async getUsers(token: string): Promise<ApiResponse<User[]>> {
    return this.request<User[]>("/users", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  async getUserProfile(token: string): Promise<ApiResponse<User>> {
    return this.request<User>("/users/profile", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  }

  // Scraper endpoints
  async scrapeData(
    request: ScraperRequest,
    token: string,
  ): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>("/scraper/getData", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(request),
    });
  }

  async getUserRatings(
    username: string,
    token: string,
  ): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>("/scraper/getUserRatings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username }),
    });
  }

  async getAllFilms(
    username: string,
    token: string,
  ): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>("/scraper/getAllFilms", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username }),
    });
  }

  // Health check
  async healthCheck(): Promise<ApiResponse> {
    return this.request<ApiResponse>("/health");
  }

  // Comparison endpoints (public - no auth required)
  async getComparisonUsernames(): Promise<
    ApiResponse<Array<{ username: string; displayName?: string }>>
  > {
    return this.request<Array<{ username: string; displayName?: string }>>(
      "/comparison/usernames",
    );
  }

  async getComparisonUserRatings(username: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>("/comparison/user-ratings", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
  }

  async compareUsers(user1: string, user2: string): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>("/comparison/compare", {
      method: "POST",
      body: JSON.stringify({ user1, user2 }),
    });
  }

  async getMoviesInCommon(
    user1: string,
    user2: string,
  ): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>("/comparison/movies-in-common", {
      method: "POST",
      body: JSON.stringify({ user1, user2 }),
    });
  }

  // Hater rankings endpoint
  async getHaterRankings(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>("/comparison/hater-rankings");
  }

  // New Hater rankings
  async getHaterRankings2(): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>("/comparison/v2/hater-rankings");
  }

  // New database-first film user endpoints (no auth required)
  async getFilmUserRatings(
    username: string,
    fallback: boolean = false,
  ): Promise<ApiResponse<any>> {
    const fallbackParam = fallback ? "?fallback=scrape" : "";
    return this.request<ApiResponse<any>>(
      `/film-users/${username}/ratings${fallbackParam}`,
    );
  }

  async getFilmUserProfile(
    username: string,
    fallback: boolean = false,
  ): Promise<ApiResponse<any>> {
    const fallbackParam = fallback ? "?fallback=scrape" : "";
    return this.request<ApiResponse<any>>(
      `/film-users/${username}/profile${fallbackParam}`,
    );
  }

  async getFilmUserComplete(
    username: string,
    fallback: boolean = false,
  ): Promise<ApiResponse<any>> {
    const fallbackParam = fallback ? "?fallback=scrape" : "";
    return this.request<ApiResponse<any>>(
      `/film-users/${username}/complete${fallbackParam}`,
    );
  }

  async getFilmUsers(): Promise<
    ApiResponse<Array<{ username: string; displayName?: string }>>
  > {
    return this.request<Array<{ username: string; displayName?: string }>>(
      "/film-users",
    );
  }

  // Force scraping endpoints (auth required)
  async forceScrapeUserRatings(
    username: string,
    token: string,
  ): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>("/scraper/getUserRatings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username }),
    });
  }

  async forceScrapeUserProfile(
    username: string,
    token: string,
  ): Promise<ApiResponse<any>> {
    return this.request<ApiResponse<any>>("/scraper/getUserProfile", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username }),
    });
  }

  // Hater rankings endpoint
  async getRatingsDistribution(): Promise<
    ApiResponse<Array<{ rating: number; count: number }>>
  > {
    return this.request<Array<{ rating: number; count: number }>>(
      "/stats/total-ratings",
    );
  }

  // Hater rankings endpoint
  async getAllUserFilms(): Promise<
    ApiResponse<Array<{ rating: number; count: number }>>
  > {
    return this.request<Array<{ rating: number; count: number }>>(
      "/stats/all-user-films",
    );
  }

  // Hater rankings endpoint
  async getUserFilmsCount(): Promise<ApiResponse<number>> {
    return this.request<number>("/stats/user-films-count");
  }
  // Movie Swap endpoint
  // TODO: NEED TO STANDARDIZE MOVIE OBJECT, TOO MANY VARIATIONS
  async getMovieSwap(
    user1: string,
    user2: string,
  ): Promise<ApiResponse<{ filmSlug: string; title: string }[]>> {
    return this.request<{ filmSlug: string; title: string }[]>(
      "/comparison/movie-swap",
    );
  }

  async getMflScoringMetrics(): Promise<ApiResponse<MFLScoringMetric[]>> {
    return this.request<MFLScoringMetric[]>("/mfl/scoring-metrics");
  }

  async getMflMovies(): Promise<
    ApiResponse<{ title: string; filmSlug: string }[]>
  > {
    return this.request<{ title: string; filmSlug: string }[]>("/mfl/movies");
  }

  async getMflMovieScore(
    filmSlug: string,
  ): Promise<ApiResponse<MFLMovieScore[]>> {
    return this.request<MFLMovieScore[]>(`/mfl/movie-score/${filmSlug}`);
  }

  async upsertMflMovieScore(
    filmSlug: string,
    pointsAwarded: number,
    metricId: number,
    scoringId?: number,
  ): Promise<ApiResponse<any>> {
    return this.request<any>(`/mfl/upsert-movie-score`, {
      method: "POST",
      body: JSON.stringify({ filmSlug, pointsAwarded, metricId, scoringId }),
    });
  }

  async deleteMflScoringMetric(scoringId: number): Promise<ApiResponse<any>> {
    return this.request<any>(`/mfl/delete-scoring-metric/${scoringId}`, {
      method: "DELETE",
    });
  }
  // ===========================
  // Award Show endpoints
  // ===========================

  async getAwardShows(): Promise<ApiResponse<AwardShow[]>> {
    return this.request<AwardShow[]>("/events/award-shows");
  }

  async createAwardShow(
    data: { name: string; slug: string; description?: string },
    token: string,
  ): Promise<ApiResponse<AwardShow>> {
    return this.request<AwardShow>("/events/admin/award-shows", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  }

  // ===========================
  // Event endpoints (public)
  // ===========================

  async getEvents(status?: string): Promise<ApiResponse<EventSummary[]>> {
    const query = status ? `?status=${status}` : "";
    return this.request<EventSummary[]>(`/events${query}`);
  }

  async getEventBySlug(slug: string): Promise<ApiResponse<EventData>> {
    return this.request<EventData>(`/events/${slug}`);
  }

  // Event endpoints (authenticated)
  async submitEventPick(
    categoryId: string,
    nomineeId: string,
    token: string,
  ): Promise<ApiResponse> {
    return this.request("/events/picks", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ categoryId, nomineeId }),
    });
  }

  async getMyEventPicks(
    slug: string,
    token: string,
  ): Promise<ApiResponse<EventUserPick[]>> {
    return this.request<EventUserPick[]>(`/events/${slug}/my-picks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  // Event admin endpoints
  async createEvent(
    data: {
      awardShowId: string;
      name: string;
      slug: string;
      year: number;
      editionNumber?: number;
      nominationsDate?: string;
      awardsDate?: string;
      status?: string;
    },
    token: string,
  ): Promise<ApiResponse<EventData>> {
    return this.request<EventData>("/events/admin/events", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  }

  async updateEvent(
    id: string,
    data: Partial<{
      name: string;
      slug: string;
      year: number;
      nominationsDate: string;
      awardsDate: string;
      status: string;
    }>,
    token: string,
  ): Promise<ApiResponse> {
    return this.request(`/events/admin/events/${id}`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  }

  async upsertEventCategory(
    data: {
      id?: string;
      eventId: string;
      name: string;
      displayOrder: number;
      displayMode?: string;
    },
    token: string,
  ): Promise<ApiResponse> {
    return this.request("/events/admin/categories", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  }

  async deleteEventCategory(id: string, token: string): Promise<ApiResponse> {
    return this.request(`/events/admin/categories/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async upsertEventNominee(
    data: {
      id?: string;
      categoryId: string;
      personName?: string;
      movieOrShowName: string;
      isWinner?: boolean;
    },
    token: string,
  ): Promise<ApiResponse> {
    return this.request("/events/admin/nominees", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify(data),
    });
  }

  async deleteEventNominee(id: string, token: string): Promise<ApiResponse> {
    return this.request(`/events/admin/nominees/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
  }

  async setEventWinner(
    nomineeId: string,
    isWinner: boolean,
    token: string,
  ): Promise<ApiResponse> {
    return this.request(`/events/admin/nominees/${nomineeId}/winner`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${token}` },
      body: JSON.stringify({ isWinner }),
    });
  }

  async pathFinder(
    actor1: string,
    actor2: string,
    signal?: AbortSignal,
  ): Promise<ApiResponse> {
    // Endpoint is public; no auth header.
    return this.request(`/actor-graph/path-finder/${actor1}/${actor2}`, {
      method: "GET",
      ...(signal ? { signal } : {}),
    });
  }

  // Combined actor + movie search backed by /api/actor-graph/search.
  // Returns DB-cached hits first, then TMDB results for items not yet seeded.
  async searchGraph(
    query: string,
    signal?: AbortSignal,
  ): Promise<ApiResponse> {
    return this.request(`/actor-graph/search?q=${encodeURIComponent(query)}`, {
      method: "GET",
      ...(signal ? { signal } : {}),
    });
  }
}

export const apiService = new ApiService();
export default apiService;
