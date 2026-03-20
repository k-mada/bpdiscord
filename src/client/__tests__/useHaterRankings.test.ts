import { renderHook, waitFor, act } from "@testing-library/react";
import { useHaterRankings, useHaterRankings2 } from "../hooks/useHaterRankings";
import apiService from "../services/api";

vi.mock("../services/api");

const mockRankingsV1 = [
  {
    username: "alice",
    displayName: "Alice",
    averageRating: 2.5,
    totalRatings: 100,
    ratingDistribution: [
      { rating: 1, count: 20 },
      { rating: 3, count: 50 },
      { rating: 5, count: 30 },
    ],
  },
  {
    username: "bob",
    displayName: "Bob",
    averageRating: 3.75,
    totalRatings: 200,
    ratingDistribution: [
      { rating: 2, count: 40 },
      { rating: 4, count: 160 },
    ],
  },
];

const mockRankingsV2 = [
  {
    username: "alice",
    displayName: "Alice",
    filmsRated: 100,
    differential: -50.0,
    adjustedDifferential: -25.0,
  },
  {
    username: "bob",
    displayName: "Bob",
    filmsRated: 200,
    differential: 30.0,
    adjustedDifferential: 15.0,
  },
];

describe("useHaterRankings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial fetch", () => {
    it("starts in a loading state", () => {
      vi.mocked(apiService.getHaterRankings).mockReturnValue(
        new Promise(() => {})
      );

      const { result } = renderHook(() => useHaterRankings());

      expect(result.current.loading).toBe(true);
      expect(result.current.rankings).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("fetches rankings on mount and sets data", async () => {
      vi.mocked(apiService.getHaterRankings).mockResolvedValue({
        data: mockRankingsV1,
      });

      const { result } = renderHook(() => useHaterRankings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rankings).toEqual(mockRankingsV1);
      expect(result.current.error).toBeNull();
      expect(apiService.getHaterRankings).toHaveBeenCalledTimes(1);
    });

    it("handles API returning no data gracefully", async () => {
      vi.mocked(apiService.getHaterRankings).mockResolvedValue({
        data: undefined,
      });

      const { result } = renderHook(() => useHaterRankings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rankings).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe("error handling", () => {
    it("sets error when API call fails", async () => {
      vi.mocked(apiService.getHaterRankings).mockRejectedValue(
        new Error("Network error")
      );

      const { result } = renderHook(() => useHaterRankings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Failed to load hater rankings");
      expect(result.current.rankings).toEqual([]);
    });

    it("clears previous error on successful refetch", async () => {
      vi.mocked(apiService.getHaterRankings)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ data: mockRankingsV1 });

      const { result } = renderHook(() => useHaterRankings());

      await waitFor(() => {
        expect(result.current.error).toBe("Failed to load hater rankings");
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.rankings).toEqual(mockRankingsV1);
    });
  });

  describe("refetch", () => {
    it("refetches data when refetch is called", async () => {
      const updatedRankings = [mockRankingsV1[0]!];

      vi.mocked(apiService.getHaterRankings)
        .mockResolvedValueOnce({ data: mockRankingsV1 })
        .mockResolvedValueOnce({ data: updatedRankings });

      const { result } = renderHook(() => useHaterRankings());

      await waitFor(() => {
        expect(result.current.rankings).toEqual(mockRankingsV1);
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.rankings).toEqual(updatedRankings);
      expect(apiService.getHaterRankings).toHaveBeenCalledTimes(2);
    });

    it("sets loading to true during refetch", async () => {
      let resolveSecondCall: (value: any) => void;
      const secondCallPromise = new Promise((resolve) => {
        resolveSecondCall = resolve;
      });

      vi.mocked(apiService.getHaterRankings)
        .mockResolvedValueOnce({ data: mockRankingsV1 })
        .mockReturnValueOnce(secondCallPromise as any);

      const { result } = renderHook(() => useHaterRankings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      await act(async () => {
        resolveSecondCall!({ data: mockRankingsV1 });
      });

      expect(result.current.loading).toBe(false);
    });
  });
});

describe("useHaterRankings2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initial fetch", () => {
    it("starts in a loading state", () => {
      vi.mocked(apiService.getHaterRankings2).mockReturnValue(
        new Promise(() => {})
      );

      const { result } = renderHook(() => useHaterRankings2());

      expect(result.current.loading).toBe(true);
      expect(result.current.rankings).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("fetches rankings on mount and sets data", async () => {
      vi.mocked(apiService.getHaterRankings2).mockResolvedValue({
        data: mockRankingsV2,
      });

      const { result } = renderHook(() => useHaterRankings2());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.rankings).toEqual(mockRankingsV2);
      expect(result.current.error).toBeNull();
      expect(apiService.getHaterRankings2).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling", () => {
    it("sets error when API call fails", async () => {
      vi.mocked(apiService.getHaterRankings2).mockRejectedValue(
        new Error("Server error")
      );

      const { result } = renderHook(() => useHaterRankings2());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Failed to load hater rankings");
      expect(result.current.rankings).toEqual([]);
    });
  });

  describe("refetch", () => {
    it("refetches data when refetch is called", async () => {
      const updatedRankings = [mockRankingsV2[0]!];

      vi.mocked(apiService.getHaterRankings2)
        .mockResolvedValueOnce({ data: mockRankingsV2 })
        .mockResolvedValueOnce({ data: updatedRankings });

      const { result } = renderHook(() => useHaterRankings2());

      await waitFor(() => {
        expect(result.current.rankings).toEqual(mockRankingsV2);
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.rankings).toEqual(updatedRankings);
      expect(apiService.getHaterRankings2).toHaveBeenCalledTimes(2);
    });

    it("clears previous error on successful refetch", async () => {
      vi.mocked(apiService.getHaterRankings2)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ data: mockRankingsV2 });

      const { result } = renderHook(() => useHaterRankings2());

      await waitFor(() => {
        expect(result.current.error).toBe("Failed to load hater rankings");
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.rankings).toEqual(mockRankingsV2);
    });
  });
});
