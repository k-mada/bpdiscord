import { renderHook, waitFor } from "@testing-library/react";
import { useMoviesInCommon } from "../hooks/useMoviesInCommon";
import { apiService } from "../services/api";
import type { MoviesInCommonData } from "../types";

vi.mock("../services/api", () => ({
  apiService: {
    getMoviesInCommon: vi.fn(),
  },
}));

const mockData: MoviesInCommonData = {
  user1: "alice",
  user2: "bob",
  count: 1,
  moviesInCommon: [
    {
      title: "Heat",
      film_slug: "heat",
      user1_rating: 5,
      user2_rating: 4.5,
      poster: null,
      year: 1995,
      letterboxd_url: null,
      total_ratings: 100,
    },
  ],
  compatibility: { pearson: null, mad: 0.5, sampleSize: 1 },
};

const mockGetMoviesInCommon = vi.mocked(apiService.getMoviesInCommon);

describe("useMoviesInCommon", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch until both users are set", async () => {
    const { result } = renderHook(() => useMoviesInCommon("alice", null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(mockGetMoviesInCommon).not.toHaveBeenCalled();
  });

  it("does not fetch when both users are the same", async () => {
    renderHook(() => useMoviesInCommon("alice", "alice"));

    expect(mockGetMoviesInCommon).not.toHaveBeenCalled();
  });

  it("fetches and returns the movies in common for a distinct pair", async () => {
    mockGetMoviesInCommon.mockResolvedValue({ data: mockData });

    const { result } = renderHook(() => useMoviesInCommon("alice", "bob"));

    await waitFor(() => expect(result.current.data).toEqual(mockData));
    expect(mockGetMoviesInCommon).toHaveBeenCalledWith(
      "alice",
      "bob",
      expect.any(AbortSignal),
    );
    expect(result.current.loading).toBe(false);
  });

  it("sets an error when the request fails", async () => {
    mockGetMoviesInCommon.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useMoviesInCommon("alice", "bob"));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.data).toBeNull();
  });
});
