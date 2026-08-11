import { renderHook, waitFor } from "@testing-library/react";
import { useFilmDetail } from "../hooks/useFilmDetail";
import { apiService } from "../services/api";
import { ApiError } from "../lib/apiError";
import type { FilmDetail } from "../../shared/types";

vi.mock("../services/api", () => ({
  apiService: {
    getFilmDetail: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiService.getFilmDetail);

const film: FilmDetail = {
  filmSlug: "heat",
  title: "Heat",
  releaseYear: 1995,
  poster: "",
  letterboxdUrl: null,
  letterboxdRating: 4.3,
  watchedCount: 5,
  ratedCount: 4,
  averageRating: 4.25,
  ratings: [],
};

describe("useFilmDetail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches discord-scoped detail by default", async () => {
    mockGet.mockResolvedValue({ data: film });

    const { result } = renderHook(() => useFilmDetail("heat"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGet).toHaveBeenCalledWith(
      "heat",
      { includeNonDiscord: false },
      expect.any(AbortSignal),
    );
    expect(result.current.data).toEqual(film);
    expect(result.current.error).toBeNull();
    expect(result.current.notFound).toBe(false);
  });

  it("passes the includeNonDiscord flag through", async () => {
    mockGet.mockResolvedValue({ data: film });

    renderHook(() => useFilmDetail("heat", true));

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        "heat",
        { includeNonDiscord: true },
        expect.any(AbortSignal),
      ),
    );
  });

  it("refetches when the slug changes", async () => {
    mockGet.mockResolvedValue({ data: film });

    const { rerender } = renderHook(({ slug }) => useFilmDetail(slug), {
      initialProps: { slug: "heat" },
    });
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));

    rerender({ slug: "collateral" });
    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(2));
    expect(mockGet.mock.calls[1]![0]).toBe("collateral");
  });

  it("flags a 404 as notFound rather than an error", async () => {
    mockGet.mockRejectedValue(new ApiError("nope", 404));

    const { result } = renderHook(() => useFilmDetail("ghost"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.notFound).toBe(true);
    expect(result.current.error).toBeNull();
  });

  it("sets an error for a non-404 failure", async () => {
    mockGet.mockRejectedValue(new ApiError("boom", 500));

    const { result } = renderHook(() => useFilmDetail("heat"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe("Failed to load film");
    expect(result.current.notFound).toBe(false);
  });

  it("sets an error when the payload has no data", async () => {
    mockGet.mockResolvedValue({ error: "db down" });

    const { result } = renderHook(() => useFilmDetail("heat"));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBe("Failed to load film");
  });

  it("aborts the in-flight request on unmount", async () => {
    mockGet.mockResolvedValue({ data: film });

    const { unmount } = renderHook(() => useFilmDetail("heat"));
    await waitFor(() => expect(mockGet).toHaveBeenCalled());

    const signal = mockGet.mock.calls[0]![2] as AbortSignal;
    expect(signal.aborted).toBe(false);
    unmount();
    expect(signal.aborted).toBe(true);
  });

  // act() flushes effects before assertions, so the offending frame is only
  // visible by recording what every render pass returned.
  it("reports loading on the very first render pass", () => {
    mockGet.mockReturnValue(new Promise(() => {}));
    const seen: Array<{ loading: boolean; error: string | null }> = [];

    renderHook(() => {
      const r = useFilmDetail("heat");
      seen.push({ loading: r.loading, error: r.error });
      return r;
    });

    expect(seen[0]).toEqual({ loading: true, error: null });
    expect(seen.some((s) => !s.loading)).toBe(false);
  });

  it("never returns the previous film's data while the next one loads", async () => {
    mockGet.mockResolvedValue({ data: film });
    const seen: Array<{ slug: string; data: FilmDetail | null }> = [];

    const { result, rerender } = renderHook(
      ({ slug }) => {
        const r = useFilmDetail(slug);
        seen.push({ slug, data: r.data });
        return r;
      },
      { initialProps: { slug: "heat" } },
    );
    await waitFor(() => expect(result.current.data).toEqual(film));

    mockGet.mockReturnValue(new Promise(() => {}));
    seen.length = 0;
    rerender({ slug: "collateral" });

    expect(seen.every((s) => s.data === null)).toBe(true);
  });

  it("does not fetch without a slug", () => {
    renderHook(() => useFilmDetail(null));

    expect(mockGet).not.toHaveBeenCalled();
  });
});
