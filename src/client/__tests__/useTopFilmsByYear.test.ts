import { renderHook, waitFor } from "@testing-library/react";
import { useTopFilmsByYear } from "../hooks/useTopFilmsByYear";
import { apiService } from "../services/api";
import type { LBFilm } from "../types";

vi.mock("../services/api", () => ({
  apiService: {
    getTopFilmsByYear: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiService.getTopFilmsByYear);

const film = (slug: string): LBFilm => ({
  film_slug: slug,
  title: slug,
  watch_count: 1,
  rating_count: 1,
  average_rating: 4,
  poster: "",
  banner: "",
  tmdb_link: "",
  url: "",
});

describe("useTopFilmsByYear", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches all-time (no year) when passed null", async () => {
    mockGet.mockResolvedValue({
      data: { year: null, topRated: [film("a")], topWatched: [film("b")] },
    });

    const { result } = renderHook(() => useTopFilmsByYear(null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGet).toHaveBeenCalledWith(undefined, expect.any(AbortSignal));
    expect(result.current.topRated).toHaveLength(1);
    expect(result.current.topWatched).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it("scopes to the given year", async () => {
    mockGet.mockResolvedValue({
      data: { year: 2021, topRated: [], topWatched: [] },
    });

    renderHook(() => useTopFilmsByYear(2021));

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(2021, expect.any(AbortSignal)),
    );
  });

  it("sets an error when the payload has no data (controller 200 success:false)", async () => {
    mockGet.mockResolvedValue({ error: "db down" });

    const { result } = renderHook(() => useTopFilmsByYear(null));

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.topRated).toHaveLength(0);
  });

  it("sets an error when the request rejects", async () => {
    mockGet.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useTopFilmsByYear(null));

    await waitFor(() => expect(result.current.error).not.toBeNull());
  });

  it("refetches when the year changes", async () => {
    mockGet.mockResolvedValue({
      data: { year: null, topRated: [], topWatched: [] },
    });

    const { rerender } = renderHook(({ y }) => useTopFilmsByYear(y), {
      initialProps: { y: null as number | null },
    });

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
    rerender({ y: 2000 });
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(2000, expect.any(AbortSignal)),
    );
  });
});
