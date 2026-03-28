import { apiService } from "../services/api";

// ---------------------------------------------------------------------------
// Global fetch mock
// ---------------------------------------------------------------------------

const mockResponse = (data: unknown, ok = true, status = 200) =>
  Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
  } as Response);

const TOKEN = "test-jwt-token";
const USERNAME = "alice";
const SLUG = "oscars-2025";
const UUID = "abc-123";

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubGlobal(
    "fetch",
    vi.fn(() => mockResponse({ data: "ok" })),
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Return the most recent `fetch` call's [url, init]. */
function lastFetchCall(): [string, RequestInit] {
  const calls = vi.mocked(fetch).mock.calls;
  const last = calls[calls.length - 1]!;
  return [last[0] as string, last[1] as RequestInit];
}

/** Assert fetch was called with the expected URL suffix and HTTP method. */
function expectFetch(urlSuffix: string, method = "GET") {
  const [url, init] = lastFetchCall();
  expect(url).toBe(`/api${urlSuffix}`);
  if (method !== "GET") {
    expect(init.method).toBe(method);
  }
}

/** Assert the Authorization header was set with the given token. */
function expectAuth(token: string) {
  const [, init] = lastFetchCall();
  const headers = init.headers as Record<string, string>;
  expect(headers["Authorization"]).toBe(`Bearer ${token}`);
}

/** Assert the request body matches the expected value. */
function expectBody(expected: unknown) {
  const [, init] = lastFetchCall();
  expect(JSON.parse(init.body as string)).toEqual(expected);
}

// ===========================================================================
// Tests
// ===========================================================================

describe("ApiService", () => {
  // -------------------------------------------------------------------------
  // Private request() method (tested indirectly via public methods)
  // -------------------------------------------------------------------------

  describe("request() core behavior", () => {
    it("sets Content-Type to application/json by default", async () => {
      await apiService.healthCheck();
      const [, init] = lastFetchCall();
      const headers = init.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("throws and logs when response is not ok", async () => {
      vi.mocked(fetch).mockImplementation(() =>
        mockResponse({ error: "Unauthorized" }, false, 401),
      );
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(apiService.healthCheck()).rejects.toThrow("Unauthorized");
      expect(spy).toHaveBeenCalledWith(
        "API request failed:",
        expect.any(Error),
      );
    });

    it("uses status text when no error field in response body", async () => {
      vi.mocked(fetch).mockImplementation(() => mockResponse({}, false, 500));
      vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(apiService.healthCheck()).rejects.toThrow(
        "Request failed with status 500",
      );
    });

    it("throws on network-level failures", async () => {
      vi.mocked(fetch).mockRejectedValue(new TypeError("Failed to fetch"));
      vi.spyOn(console, "error").mockImplementation(() => {});

      await expect(apiService.healthCheck()).rejects.toThrow("Failed to fetch");
    });
  });

  // -------------------------------------------------------------------------
  // Simple GET endpoints (no auth, no params)
  // -------------------------------------------------------------------------

  describe.each([
    ["healthCheck", "/health"],
    ["getComparisonUsernames", "/comparison/usernames"],
    ["getHaterRankings", "/comparison/hater-rankings"],
    ["getHaterRankings2", "/comparison/v2/hater-rankings"],
    ["getFilmUsers", "/film-users"],
    ["getRatingsDistribution", "/stats/total-ratings"],
    ["getAllUserFilms", "/stats/all-user-films"],
    ["getUserFilmsCount", "/stats/user-films-count"],
    ["getMflScoringMetrics", "/mfl/scoring-metrics"],
    ["getMflMovies", "/mfl/movies"],
    ["getAwardShows", "/events/award-shows"],
  ] as const)("%s", (method, expectedUrl) => {
    it(`calls GET ${expectedUrl}`, async () => {
      await (apiService as any)[method]();
      expectFetch(expectedUrl);
    });

    it("returns parsed response data", async () => {
      vi.mocked(fetch).mockImplementation(() =>
        mockResponse({ data: [1, 2, 3] }),
      );
      const result = await (apiService as any)[method]();
      expect(result).toEqual({ data: [1, 2, 3] });
    });
  });

  // -------------------------------------------------------------------------
  // GET endpoints with auth token
  // -------------------------------------------------------------------------

  describe.each([
    ["getUsers", "/users"],
    ["getUserProfile", "/users/profile"],
  ] as const)("%s", (method, expectedUrl) => {
    it(`calls GET ${expectedUrl} with auth header`, async () => {
      await (apiService as any)[method](TOKEN);
      expectFetch(expectedUrl);
      expectAuth(TOKEN);
    });
  });

  // -------------------------------------------------------------------------
  // POST endpoints (no auth) — body from args
  // -------------------------------------------------------------------------

  describe.each([
    [
      "getComparisonUserRatings",
      "/comparison/user-ratings",
      [USERNAME],
      { username: USERNAME },
    ],
    [
      "compareUsers",
      "/comparison/compare",
      ["alice", "bob"],
      { user1: "alice", user2: "bob" },
    ],
    [
      "getMoviesInCommon",
      "/comparison/movies-in-common",
      ["alice", "bob"],
      { user1: "alice", user2: "bob" },
    ],
  ] as const)("%s", (method, expectedUrl, args, expectedBody) => {
    it(`calls POST ${expectedUrl}`, async () => {
      await (apiService as any)[method](...args);
      expectFetch(expectedUrl, "POST");
      expectBody(expectedBody);
    });
  });

  // -------------------------------------------------------------------------
  // Auth endpoints (POST, no token, body from args)
  // -------------------------------------------------------------------------

  describe("auth endpoints", () => {
    it("signup sends user data", async () => {
      const userData = {
        email: "a@b.com",
        password: "pw",
        username: "alice",
        name: "alice doe",
      };
      await apiService.signup(userData);
      expectFetch("/auth/signup", "POST");
      expectBody(userData);
    });

    it("login sends credentials", async () => {
      const creds = { email: "a@b.com", password: "pw" };
      await apiService.login(creds);
      expectFetch("/auth/login", "POST");
      expectBody(creds);
    });

    it("requestPasswordReset sends email", async () => {
      await apiService.requestPasswordReset("a@b.com");
      expectFetch("/auth/forgot-password", "POST");
      expectBody({ email: "a@b.com" });
    });

    it("confirmPasswordReset sends reset data", async () => {
      const data = { token: "t", password: "new-pw" };
      await apiService.confirmPasswordReset(data);
      expectFetch("/auth/reset-password", "POST");
      expectBody(data);
    });
  });

  // -------------------------------------------------------------------------
  // Scraper endpoints (POST + auth + username body)
  // -------------------------------------------------------------------------

  describe.each([
    ["getUserRatings", "/scraper/getUserRatings"],
    ["getAllFilms", "/scraper/getAllFilms"],
    ["forceScrapeUserRatings", "/scraper/getUserRatings"],
    ["forceScrapeUserProfile", "/scraper/getUserProfile"],
  ] as const)("%s", (method, expectedUrl) => {
    it(`calls POST ${expectedUrl} with auth and username`, async () => {
      await (apiService as any)[method](USERNAME, TOKEN);
      expectFetch(expectedUrl, "POST");
      expectAuth(TOKEN);
      expectBody({ username: USERNAME });
    });
  });

  describe("scrapeData", () => {
    it("calls POST /scraper/getData with auth and request body", async () => {
      const request = {
        url: "https://letterboxd.com/alice",
        selectors: [".data"],
      };
      await apiService.scrapeData(request as any, TOKEN);
      expectFetch("/scraper/getData", "POST");
      expectAuth(TOKEN);
      expectBody(request);
    });
  });

  // -------------------------------------------------------------------------
  // Film-user endpoints with optional fallback param
  // -------------------------------------------------------------------------

  describe.each([
    ["getFilmUserRatings", "ratings"],
    ["getFilmUserProfile", "profile"],
    ["getFilmUserComplete", "complete"],
  ] as const)("%s", (method, segment) => {
    it(`calls GET /film-users/${USERNAME}/${segment}`, async () => {
      await (apiService as any)[method](USERNAME);
      expectFetch(`/film-users/${USERNAME}/${segment}`);
    });

    it("appends ?fallback=scrape when fallback is true", async () => {
      await (apiService as any)[method](USERNAME, true);
      expectFetch(`/film-users/${USERNAME}/${segment}?fallback=scrape`);
    });

    it("omits fallback param when false", async () => {
      await (apiService as any)[method](USERNAME, false);
      expectFetch(`/film-users/${USERNAME}/${segment}`);
    });
  });

  // -------------------------------------------------------------------------
  // MFL endpoints with specific signatures
  // -------------------------------------------------------------------------

  describe("getMovieSwap", () => {
    it("calls GET /comparison/movie-swap (params unused)", async () => {
      await apiService.getMovieSwap("alice", "bob");
      expectFetch("/comparison/movie-swap");
    });
  });

  describe("getMflMovieScore", () => {
    it("calls GET /mfl/movie-score/:filmSlug", async () => {
      await apiService.getMflMovieScore("dune-part-two");
      expectFetch("/mfl/movie-score/dune-part-two");
    });
  });

  describe("upsertMflMovieScore", () => {
    it("calls POST with all fields", async () => {
      await apiService.upsertMflMovieScore("dune", 10, 1, 42);
      expectFetch("/mfl/upsert-movie-score", "POST");
      expectBody({
        filmSlug: "dune",
        pointsAwarded: 10,
        metricId: 1,
        scoringId: 42,
      });
    });

    it("sends undefined scoringId when omitted", async () => {
      await apiService.upsertMflMovieScore("dune", 10, 1);
      expectBody({ filmSlug: "dune", pointsAwarded: 10, metricId: 1 });
    });
  });

  describe("deleteMflScoringMetric", () => {
    it("calls DELETE /mfl/delete-scoring-metric/:id", async () => {
      await apiService.deleteMflScoringMetric(42);
      expectFetch("/mfl/delete-scoring-metric/42", "DELETE");
    });
  });

  // -------------------------------------------------------------------------
  // Event endpoints (public)
  // -------------------------------------------------------------------------

  describe("getEvents", () => {
    it("calls GET /events without query when no status", async () => {
      await apiService.getEvents();
      expectFetch("/events");
    });

    it("appends ?status= when status is provided", async () => {
      await apiService.getEvents("active");
      expectFetch("/events?status=active");
    });
  });

  describe("getEventBySlug", () => {
    it("calls GET /events/:slug", async () => {
      await apiService.getEventBySlug(SLUG);
      expectFetch(`/events/${SLUG}`);
    });
  });

  // -------------------------------------------------------------------------
  // Event endpoints (authenticated)
  // -------------------------------------------------------------------------

  describe("submitEventPick", () => {
    it("calls POST /events/picks with auth and body", async () => {
      await apiService.submitEventPick("cat-1", "nom-1", TOKEN);
      expectFetch("/events/picks", "POST");
      expectAuth(TOKEN);
      expectBody({ categoryId: "cat-1", nomineeId: "nom-1" });
    });
  });

  describe("getMyEventPicks", () => {
    it("calls GET /events/:slug/my-picks with auth", async () => {
      await apiService.getMyEventPicks(SLUG, TOKEN);
      expectFetch(`/events/${SLUG}/my-picks`);
      expectAuth(TOKEN);
    });
  });

  // -------------------------------------------------------------------------
  // Event admin endpoints (POST/PUT/DELETE + auth)
  // -------------------------------------------------------------------------

  describe("createAwardShow", () => {
    it("calls POST /events/admin/award-shows with auth and body", async () => {
      const data = {
        name: "Oscars",
        slug: "oscars",
        description: "Academy Awards",
      };
      await apiService.createAwardShow(data, TOKEN);
      expectFetch("/events/admin/award-shows", "POST");
      expectAuth(TOKEN);
      expectBody(data);
    });
  });

  describe("createEvent", () => {
    it("calls POST /events/admin/events with auth and body", async () => {
      const data = {
        awardShowId: UUID,
        name: "97th Oscars",
        slug: "oscars-2025",
        year: 2025,
      };
      await apiService.createEvent(data, TOKEN);
      expectFetch("/events/admin/events", "POST");
      expectAuth(TOKEN);
      expectBody(data);
    });
  });

  describe("updateEvent", () => {
    it("calls PUT /events/admin/events/:id with auth and body", async () => {
      const data = { name: "Updated Name", status: "active" };
      await apiService.updateEvent(UUID, data, TOKEN);
      expectFetch(`/events/admin/events/${UUID}`, "PUT");
      expectAuth(TOKEN);
      expectBody(data);
    });
  });

  describe("upsertEventCategory", () => {
    it("calls POST /events/admin/categories with auth and body", async () => {
      const data = { eventId: UUID, name: "Best Picture", displayOrder: 1 };
      await apiService.upsertEventCategory(data, TOKEN);
      expectFetch("/events/admin/categories", "POST");
      expectAuth(TOKEN);
      expectBody(data);
    });
  });

  describe("deleteEventCategory", () => {
    it("calls DELETE /events/admin/categories/:id with auth", async () => {
      await apiService.deleteEventCategory(UUID, TOKEN);
      expectFetch(`/events/admin/categories/${UUID}`, "DELETE");
      expectAuth(TOKEN);
    });
  });

  describe("upsertEventNominee", () => {
    it("calls POST /events/admin/nominees with auth and body", async () => {
      const data = {
        categoryId: UUID,
        movieOrShowName: "Anora",
        isWinner: false,
      };
      await apiService.upsertEventNominee(data, TOKEN);
      expectFetch("/events/admin/nominees", "POST");
      expectAuth(TOKEN);
      expectBody(data);
    });
  });

  describe("deleteEventNominee", () => {
    it("calls DELETE /events/admin/nominees/:id with auth", async () => {
      await apiService.deleteEventNominee(UUID, TOKEN);
      expectFetch(`/events/admin/nominees/${UUID}`, "DELETE");
      expectAuth(TOKEN);
    });
  });

  describe("setEventWinner", () => {
    it("calls PUT /events/admin/nominees/:id/winner with auth and body", async () => {
      await apiService.setEventWinner(UUID, true, TOKEN);
      expectFetch(`/events/admin/nominees/${UUID}/winner`, "PUT");
      expectAuth(TOKEN);
      expectBody({ isWinner: true });
    });
  });
});
