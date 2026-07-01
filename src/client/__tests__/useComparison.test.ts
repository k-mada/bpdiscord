import { renderHook, waitFor, act } from "@testing-library/react";
import { useComparison } from "../hooks/useComparison";
import { apiService } from "../services/api";
import { describeFetchHookLifecycle } from "./helpers/hookTestFactory";
import type { FilmUserComplete } from "../types";

vi.mock("../services/api", () => ({
  apiService: {
    getFilmUsers: vi.fn(),
    getFilmUserComplete: vi.fn(),
  },
}));

const mockUsernames = [
  { username: "alice", displayName: "Alice" },
  { username: "bob", displayName: "Bob" },
  { username: "charlie" },
];

const mockUserComplete: FilmUserComplete = {
  username: "alice",
  displayName: "Alice",
  followers: 150,
  following: 80,
  numberOfLists: 5,
  totalRatings: 300,
  totalWatched: 320,
  source: "letterboxd",
  success: true,
  ratings: [
    { rating: 3, count: 100 },
    { rating: 4, count: 150 },
    { rating: 5, count: 50 },
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
    it("fetches complete user data by username and returns the payload", async () => {
      vi.mocked(apiService.getFilmUserComplete).mockResolvedValue({
        data: mockUserComplete,
      });

      const result = await renderLoadedHook();

      let userData: typeof mockUserComplete | undefined;
      await act(async () => {
        userData = await result.current.getUserComplete("alice");
      });

      expect(apiService.getFilmUserComplete).toHaveBeenCalledWith("alice");
      expect(userData).toEqual(mockUserComplete);
    });
  });
});
