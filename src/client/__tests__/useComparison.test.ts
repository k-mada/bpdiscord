import { renderHook, waitFor, act } from "@testing-library/react";
import { useComparison } from "../hooks/useComparison";
import { apiService } from "../services/api";
import { describeFetchHookLifecycle } from "./helpers/hookTestFactory";

vi.mock("../services/api", () => ({
  apiService: {
    getFilmUsers: vi.fn(),
    getFilmUserComplete: vi.fn(),
    getMoviesInCommon: vi.fn(),
  },
}));

const mockUsernames = [
  { username: "alice", displayName: "Alice" },
  { username: "bob", displayName: "Bob" },
  { username: "charlie" },
];

const mockUserComplete = {
  username: "alice",
  displayName: "Alice",
  followers: 150,
  following: 80,
  numberOfLists: 5,
  totalRatings: 300,
  ratings: [
    { rating: 3, count: 100 },
    { rating: 4, count: 150 },
    { rating: 5, count: 50 },
  ],
};

const mockMoviesInCommon = {
  user1: "alice",
  user2: "bob",
  count: 2,
  moviesInCommon: [
    {
      title: "The Brutalist",
      film_slug: "the-brutalist",
      user1_rating: 4.5,
      user2_rating: 3.0,
    },
    {
      title: "Anora",
      film_slug: "anora",
      user1_rating: 4.0,
      user2_rating: 4.5,
    },
  ],
};

/** Render hook and wait for initial load to complete */
async function renderLoadedHook() {
  vi.mocked(apiService.getFilmUsers).mockResolvedValue({
    data: mockUsernames,
  });
  const { result } = renderHook(() => useComparison());
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
}

describe("useComparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Standard fetch-on-mount lifecycle tests
  describeFetchHookLifecycle({
    name: "useComparison",
    useHook: () => useComparison(),
    dataField: "usernames",
    mockFetchFn: vi.mocked(apiService.getFilmUsers),
    mockData: mockUsernames,
    wrapResponse: (data) => ({ data }),
    expectedError: "Failed to load users",
  });

  // Hook-specific: getUserComplete
  describe("getUserComplete", () => {
    it("fetches complete user data with fallback enabled", async () => {
      vi.mocked(apiService.getFilmUserComplete).mockResolvedValue({
        data: mockUserComplete,
      });

      const result = await renderLoadedHook();

      let userData: typeof mockUserComplete | undefined;
      await act(async () => {
        userData = await result.current.getUserComplete("alice", true);
      });

      expect(apiService.getFilmUserComplete).toHaveBeenCalledWith("alice", true);
      expect(userData).toEqual(mockUserComplete);
    });

    it("fetches complete user data with fallback disabled", async () => {
      vi.mocked(apiService.getFilmUserComplete).mockResolvedValue({
        data: mockUserComplete,
      });

      const result = await renderLoadedHook();

      await act(async () => {
        await result.current.getUserComplete("alice", false);
      });

      expect(apiService.getFilmUserComplete).toHaveBeenCalledWith("alice", false);
    });

    it("defaults fallback to true", async () => {
      vi.mocked(apiService.getFilmUserComplete).mockResolvedValue({
        data: mockUserComplete,
      });

      const result = await renderLoadedHook();

      await act(async () => {
        await result.current.getUserComplete("alice");
      });

      expect(apiService.getFilmUserComplete).toHaveBeenCalledWith("alice", true);
    });
  });

  // Hook-specific: getMoviesInCommon
  describe("getMoviesInCommon", () => {
    it("fetches movies in common for two users", async () => {
      vi.mocked(apiService.getMoviesInCommon).mockResolvedValue({
        data: mockMoviesInCommon,
      });

      const result = await renderLoadedHook();

      let moviesData: typeof mockMoviesInCommon | undefined;
      await act(async () => {
        moviesData = await result.current.getMoviesInCommon("alice", "bob");
      });

      expect(apiService.getMoviesInCommon).toHaveBeenCalledWith("alice", "bob");
      expect(moviesData).toEqual(mockMoviesInCommon);
    });

    it("returns data from API response", async () => {
      vi.mocked(apiService.getMoviesInCommon).mockResolvedValue({
        data: { user1: "alice", user2: "bob", count: 0, moviesInCommon: [] },
      });

      const result = await renderLoadedHook();

      let moviesData: { count: number; moviesInCommon: unknown[] } | undefined;
      await act(async () => {
        moviesData = await result.current.getMoviesInCommon("alice", "bob");
      });

      expect(moviesData!.count).toBe(0);
      expect(moviesData!.moviesInCommon).toEqual([]);
    });
  });
});
