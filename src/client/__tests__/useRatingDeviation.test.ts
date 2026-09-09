import { renderHook, waitFor } from "@testing-library/react";
import { useRatingDeviation } from "../hooks/useRatingDeviation";
import { apiService } from "../services/api";
import type { RatingDeviationFilm } from "../../shared/types";

vi.mock("../services/api", () => ({
  apiService: {
    getRatingDeviation: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiService.getRatingDeviation);

const film = (slug: string, deviation: number): RatingDeviationFilm => ({
  film_slug: slug,
  title: slug,
  average_rating: 4,
  lb_rating: 4 - deviation,
  deviation,
  rating_count: 20,
});

describe("useRatingDeviation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches all-time (no year) when passed null", async () => {
    mockGet.mockResolvedValue({
      data: { year: null, over: [film("a", 0.4)], under: [film("b", -0.5)] },
    });

    const { result } = renderHook(() => useRatingDeviation(null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGet).toHaveBeenCalledWith(undefined, expect.any(AbortSignal));
    expect(result.current.over).toHaveLength(1);
    expect(result.current.under).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it("scopes to the given year", async () => {
    mockGet.mockResolvedValue({ data: { year: 2021, over: [], under: [] } });

    renderHook(() => useRatingDeviation(2021));

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(2021, expect.any(AbortSignal)),
    );
  });

  it("sets an error when the payload has no data (controller 200 success:false)", async () => {
    mockGet.mockResolvedValue({ error: "db down" });

    const { result } = renderHook(() => useRatingDeviation(null));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.over).toHaveLength(0);
  });

  it("sets an error when the request rejects", async () => {
    mockGet.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useRatingDeviation(null));

    await waitFor(() => expect(result.current.error).not.toBeNull());
  });

  it("refetches when the year changes", async () => {
    mockGet.mockResolvedValue({ data: { year: null, over: [], under: [] } });

    const { rerender } = renderHook(({ y }) => useRatingDeviation(y), {
      initialProps: { y: null as number | null },
    });

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
    rerender({ y: 2000 });
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(2000, expect.any(AbortSignal)),
    );
  });
});
