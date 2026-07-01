import { renderHook, waitFor } from "@testing-library/react";
import { useMovieSwap } from "../hooks/useMovieSwap";
import { apiService } from "../services/api";
import type { MovieSwapResult } from "../../shared/types";

vi.mock("../services/api", () => ({
  apiService: {
    getMovieSwap: vi.fn(),
  },
}));

const mockData: MovieSwapResult = {
  recsForUserA: [{ film_slug: "heat", title: "Heat", user_rating: 5 }],
  recsForUserB: [{ film_slug: "tenet", title: "Tenet", user_rating: null }],
};

const mockGetMovieSwap = vi.mocked(apiService.getMovieSwap);

describe("useMovieSwap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not fetch until both users are set", async () => {
    const { result } = renderHook(() => useMovieSwap("alice", null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(mockGetMovieSwap).not.toHaveBeenCalled();
  });

  it("does not fetch when both users are the same", async () => {
    renderHook(() => useMovieSwap("alice", "alice"));

    expect(mockGetMovieSwap).not.toHaveBeenCalled();
  });

  it("fetches and returns the swap for a distinct pair", async () => {
    mockGetMovieSwap.mockResolvedValue({ data: mockData });

    const { result } = renderHook(() => useMovieSwap("alice", "bob"));

    await waitFor(() => expect(result.current.data).toEqual(mockData));
    expect(mockGetMovieSwap).toHaveBeenCalledWith(
      "alice",
      "bob",
      expect.any(AbortSignal),
    );
    expect(result.current.loading).toBe(false);
  });

  it("sets an error when the request fails", async () => {
    mockGetMovieSwap.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useMovieSwap("alice", "bob"));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.data).toBeNull();
  });
});
