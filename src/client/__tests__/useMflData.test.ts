import { renderHook, waitFor, act } from "@testing-library/react";
import { useMflData } from "../hooks/useMflData";
import apiService from "../services/api";

vi.mock("../services/api");

const mockScoringMetrics = [
  {
    metricId: 1,
    metric: "Box Office",
    metricName: "gross",
    category: "domestic",
    scoringCondition: "threshold",
    pointValue: 10,
  },
  {
    metricId: 2,
    metric: "Awards",
    metricName: "oscar",
    category: "Best Picture",
    scoringCondition: "nomination",
    pointValue: 5,
  },
];

const mockMovies = [
  { title: "The Brutalist", filmSlug: "the-brutalist" },
  { title: "Anora", filmSlug: "anora" },
];

const mockMovieScores = [
  {
    scoringId: 1,
    filmSlug: "the-brutalist",
    metricId: 1,
    metricName: "gross",
    category: "domestic",
    scoringCondition: "threshold",
    pointsAwarded: 10,
  },
  {
    scoringId: 2,
    filmSlug: "the-brutalist",
    metricId: 2,
    metricName: "oscar",
    category: "Best Picture",
    scoringCondition: "nomination",
    pointsAwarded: 5,
  },
];

/** Render hook and wait for initial parallel fetch to complete */
async function renderLoadedHook() {
  vi.mocked(apiService.getMflScoringMetrics).mockResolvedValue({
    data: mockScoringMetrics,
  });
  vi.mocked(apiService.getMflMovies).mockResolvedValue({
    data: mockMovies,
  });
  const { result } = renderHook(() => useMflData());
  await waitFor(() => expect(result.current.loading).toBe(false));
  return result;
}

describe("useMflData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  /**
   * useMflData fetches two resources in parallel (metrics + movies), so
   * the standard describeFetchHookLifecycle doesn't fit cleanly. We keep
   * these initial-fetch tests inline but use renderLoadedHook() to reduce
   * boilerplate in the hook-specific tests below.
   */
  describe("initial fetch", () => {
    it("starts in a loading state with empty data", () => {
      vi.mocked(apiService.getMflScoringMetrics).mockReturnValue(
        new Promise(() => {})
      );
      vi.mocked(apiService.getMflMovies).mockReturnValue(
        new Promise(() => {})
      );

      const { result } = renderHook(() => useMflData());

      expect(result.current.loading).toBe(true);
      expect(result.current.scoringMetrics).toEqual([]);
      expect(result.current.movies).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("fetches scoring metrics and movies on mount", async () => {
      const result = await renderLoadedHook();

      expect(result.current.scoringMetrics).toEqual(mockScoringMetrics);
      expect(result.current.movies).toEqual(mockMovies);
      expect(result.current.error).toBeNull();
    });

    it("fetches metrics and movies in parallel", async () => {
      await renderLoadedHook();

      expect(apiService.getMflScoringMetrics).toHaveBeenCalledTimes(1);
      expect(apiService.getMflMovies).toHaveBeenCalledTimes(1);
    });

    it("handles undefined data gracefully", async () => {
      vi.mocked(apiService.getMflScoringMetrics).mockResolvedValue({
        data: undefined,
      });
      vi.mocked(apiService.getMflMovies).mockResolvedValue({
        data: undefined,
      });

      const { result } = renderHook(() => useMflData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.scoringMetrics).toEqual([]);
      expect(result.current.movies).toEqual([]);
    });
  });

  describe("error handling", () => {
    it("sets error when metrics fetch fails", async () => {
      vi.mocked(apiService.getMflScoringMetrics).mockRejectedValue(
        new Error("Network error")
      );
      vi.mocked(apiService.getMflMovies).mockResolvedValue({
        data: mockMovies,
      });

      const { result } = renderHook(() => useMflData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Failed to load scoring metrics");
    });

    it("sets error when movies fetch fails", async () => {
      vi.mocked(apiService.getMflScoringMetrics).mockResolvedValue({
        data: mockScoringMetrics,
      });
      vi.mocked(apiService.getMflMovies).mockRejectedValue(
        new Error("Network error")
      );

      const { result } = renderHook(() => useMflData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Failed to load movies");
    });

    it("clears error on successful refetch", async () => {
      vi.mocked(apiService.getMflScoringMetrics)
        .mockRejectedValueOnce(new Error("fail"))
        .mockResolvedValueOnce({ data: mockScoringMetrics });
      vi.mocked(apiService.getMflMovies)
        .mockResolvedValueOnce({ data: mockMovies })
        .mockResolvedValueOnce({ data: mockMovies });

      const { result } = renderHook(() => useMflData());

      await waitFor(() => {
        expect(result.current.error).toBe("Failed to load scoring metrics");
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.scoringMetrics).toEqual(mockScoringMetrics);
    });
  });

  describe("refetch", () => {
    it("refetches both metrics and movies", async () => {
      vi.mocked(apiService.getMflScoringMetrics)
        .mockResolvedValueOnce({ data: mockScoringMetrics })
        .mockResolvedValueOnce({ data: [mockScoringMetrics[0]!] });
      vi.mocked(apiService.getMflMovies)
        .mockResolvedValueOnce({ data: mockMovies })
        .mockResolvedValueOnce({ data: [mockMovies[0]!] });

      const { result } = renderHook(() => useMflData());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(apiService.getMflScoringMetrics).toHaveBeenCalledTimes(2);
      expect(apiService.getMflMovies).toHaveBeenCalledTimes(2);
    });
  });

  describe("getMovieScore", () => {
    it("fetches movie scores for a given film slug", async () => {
      vi.mocked(apiService.getMflMovieScore).mockResolvedValue({
        data: mockMovieScores,
      });

      const result = await renderLoadedHook();

      let scores: typeof mockMovieScores;
      await act(async () => {
        scores = await result.current.getMovieScore("the-brutalist");
      });

      expect(apiService.getMflMovieScore).toHaveBeenCalledWith("the-brutalist");
      expect(scores!).toEqual(mockMovieScores);
    });

    it("returns empty array when API returns no data", async () => {
      vi.mocked(apiService.getMflMovieScore).mockResolvedValue({
        data: undefined,
      });

      const result = await renderLoadedHook();

      let scores: unknown[];
      await act(async () => {
        scores = await result.current.getMovieScore("unknown-film");
      });

      expect(scores!).toEqual([]);
    });
  });

  describe("upsertMovieScore", () => {
    it("calls API with correct arguments for new score", async () => {
      vi.mocked(apiService.upsertMflMovieScore).mockResolvedValue({
        data: { success: true },
      });

      const result = await renderLoadedHook();

      await act(async () => {
        await result.current.upsertMovieScore("the-brutalist", 10, 1);
      });

      expect(apiService.upsertMflMovieScore).toHaveBeenCalledWith(
        "the-brutalist",
        10,
        1,
        undefined
      );
    });

    it("calls API with scoringId for existing score update", async () => {
      vi.mocked(apiService.upsertMflMovieScore).mockResolvedValue({
        data: { success: true },
      });

      const result = await renderLoadedHook();

      await act(async () => {
        await result.current.upsertMovieScore("the-brutalist", 15, 1, 42);
      });

      expect(apiService.upsertMflMovieScore).toHaveBeenCalledWith(
        "the-brutalist",
        15,
        1,
        42
      );
    });
  });

  describe("deleteScore", () => {
    it("calls API with the scoring ID", async () => {
      vi.mocked(apiService.deleteMflScoringMetric).mockResolvedValue({
        data: { success: true },
      });

      const result = await renderLoadedHook();

      await act(async () => {
        await result.current.deleteScore(42);
      });

      expect(apiService.deleteMflScoringMetric).toHaveBeenCalledWith(42);
    });
  });
});
