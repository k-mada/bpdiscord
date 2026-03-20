import { renderHook, waitFor, act } from "@testing-library/react";
import { useComparison } from "../hooks/useComparison";
import { apiService } from "../services/api";

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

describe("useComparison", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial fetch", () => {
    it("starts in a loading state with empty usernames", () => {
      vi.mocked(apiService.getFilmUsers).mockReturnValue(
        new Promise(() => {})
      );

      const { result } = renderHook(() => useComparison());

      expect(result.current.loading).toBe(true);
      expect(result.current.usernames).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("fetches usernames on mount and sets data", async () => {
      vi.mocked(apiService.getFilmUsers).mockResolvedValue({
        data: mockUsernames,
      });

      const { result } = renderHook(() => useComparison());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.usernames).toEqual(mockUsernames);
      expect(result.current.error).toBeNull();
      expect(apiService.getFilmUsers).toHaveBeenCalledTimes(1);
    });

    it("handles undefined data gracefully", async () => {
      vi.mocked(apiService.getFilmUsers).mockResolvedValue({
        data: undefined,
      });

      const { result } = renderHook(() => useComparison());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.usernames).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("sets error when API call fails", async () => {
      vi.mocked(apiService.getFilmUsers).mockRejectedValue(
        new Error("Network error")
      );

      const { result } = renderHook(() => useComparison());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Failed to load users");
      expect(result.current.usernames).toEqual([]);
    });

    it("clears error on successful refetch", async () => {
      vi.mocked(apiService.getFilmUsers)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ data: mockUsernames });

      const { result } = renderHook(() => useComparison());

      await waitFor(() => {
        expect(result.current.error).toBe("Failed to load users");
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.usernames).toEqual(mockUsernames);
    });
  });

  describe("refetch", () => {
    it("refetches usernames when refetch is called", async () => {
      const updatedUsernames = [
        ...mockUsernames,
        { username: "dave", displayName: "Dave" },
      ];

      vi.mocked(apiService.getFilmUsers)
        .mockResolvedValueOnce({ data: mockUsernames })
        .mockResolvedValueOnce({ data: updatedUsernames });

      const { result } = renderHook(() => useComparison());

      await waitFor(() => {
        expect(result.current.usernames).toEqual(mockUsernames);
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.usernames).toEqual(updatedUsernames);
      expect(apiService.getFilmUsers).toHaveBeenCalledTimes(2);
    });
  });

  describe("getUserComplete", () => {
    it("fetches complete user data with fallback enabled", async () => {
      vi.mocked(apiService.getFilmUsers).mockResolvedValue({
        data: mockUsernames,
      });
      vi.mocked(apiService.getFilmUserComplete).mockResolvedValue({
        data: mockUserComplete,
      });

      const { result } = renderHook(() => useComparison());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let userData: any;
      await act(async () => {
        userData = await result.current.getUserComplete("alice", true);
      });

      expect(apiService.getFilmUserComplete).toHaveBeenCalledWith(
        "alice",
        true
      );
      expect(userData).toEqual(mockUserComplete);
    });

    it("fetches complete user data with fallback disabled", async () => {
      vi.mocked(apiService.getFilmUsers).mockResolvedValue({
        data: mockUsernames,
      });
      vi.mocked(apiService.getFilmUserComplete).mockResolvedValue({
        data: mockUserComplete,
      });

      const { result } = renderHook(() => useComparison());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.getUserComplete("alice", false);
      });

      expect(apiService.getFilmUserComplete).toHaveBeenCalledWith(
        "alice",
        false
      );
    });

    it("defaults fallback to true", async () => {
      vi.mocked(apiService.getFilmUsers).mockResolvedValue({
        data: mockUsernames,
      });
      vi.mocked(apiService.getFilmUserComplete).mockResolvedValue({
        data: mockUserComplete,
      });

      const { result } = renderHook(() => useComparison());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.getUserComplete("alice");
      });

      expect(apiService.getFilmUserComplete).toHaveBeenCalledWith(
        "alice",
        true
      );
    });
  });

  describe("getMoviesInCommon", () => {
    it("fetches movies in common for two users", async () => {
      vi.mocked(apiService.getFilmUsers).mockResolvedValue({
        data: mockUsernames,
      });
      vi.mocked(apiService.getMoviesInCommon).mockResolvedValue({
        data: mockMoviesInCommon,
      });

      const { result } = renderHook(() => useComparison());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let moviesData: any;
      await act(async () => {
        moviesData = await result.current.getMoviesInCommon("alice", "bob");
      });

      expect(apiService.getMoviesInCommon).toHaveBeenCalledWith(
        "alice",
        "bob"
      );
      expect(moviesData).toEqual(mockMoviesInCommon);
    });

    it("returns data from API response", async () => {
      vi.mocked(apiService.getFilmUsers).mockResolvedValue({
        data: mockUsernames,
      });
      vi.mocked(apiService.getMoviesInCommon).mockResolvedValue({
        data: { user1: "alice", user2: "bob", count: 0, moviesInCommon: [] },
      });

      const { result } = renderHook(() => useComparison());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let moviesData: any;
      await act(async () => {
        moviesData = await result.current.getMoviesInCommon("alice", "bob");
      });

      expect(moviesData.count).toBe(0);
      expect(moviesData.moviesInCommon).toEqual([]);
    });
  });
});
