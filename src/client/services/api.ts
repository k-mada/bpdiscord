import {
  ApiResponse,
  User,
  AuthRequest,
  SignupRequest,
  AuthResponse,
  ScraperRequest,
  PasswordResetConfirmRequest,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "/api";

class ApiService {
  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${API_BASE_URL}${endpoint}`;
    const config: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || `Request failed with status ${response.status}`
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
    data: PasswordResetConfirmRequest
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
    token: string
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
    token: string
  ): Promise<ApiResponse<any>> {
    console.log("TOKEN", token);
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
    token: string
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
      "/comparison/usernames"
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
    user2: string
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
    fallback: boolean = false
  ): Promise<ApiResponse<any>> {
    const fallbackParam = fallback ? "?fallback=scrape" : "";
    return this.request<ApiResponse<any>>(
      `/film-users/${username}/ratings${fallbackParam}`
    );
  }

  async getFilmUserProfile(
    username: string,
    fallback: boolean = false
  ): Promise<ApiResponse<any>> {
    const fallbackParam = fallback ? "?fallback=scrape" : "";
    return this.request<ApiResponse<any>>(
      `/film-users/${username}/profile${fallbackParam}`
    );
  }

  async getFilmUserComplete(
    username: string,
    fallback: boolean = false
  ): Promise<ApiResponse<any>> {
    const fallbackParam = fallback ? "?fallback=scrape" : "";
    return this.request<ApiResponse<any>>(
      `/film-users/${username}/complete${fallbackParam}`
    );
  }

  async getFilmUsers(): Promise<
    ApiResponse<Array<{ username: string; displayName?: string }>>
  > {
    return this.request<Array<{ username: string; displayName?: string }>>(
      "/film-users"
    );
  }

  // Force scraping endpoints (auth required)
  async forceScrapeUserRatings(
    username: string,
    token: string
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
    token: string
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
      "/stats/total-ratings"
    );
  }

  // Hater rankings endpoint
  async getAllUserFilms(): Promise<
    ApiResponse<Array<{ rating: number; count: number }>>
  > {
    return this.request<Array<{ rating: number; count: number }>>(
      "/stats/all-user-films"
    );
  }

  // Hater rankings endpoint
  async getUserFilmsCount(): Promise<ApiResponse<number>> {
    return this.request<number>("/stats/user-films-count");
  }
}

export const apiService = new ApiService();
export default apiService;
