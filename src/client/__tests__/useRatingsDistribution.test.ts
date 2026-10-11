import { renderHook, waitFor } from "@testing-library/react";
import { useRatingsDistribution } from "../hooks/useRatingsDistribution";
import { apiService } from "../services/api";

vi.mock("../services/api", () => ({
  apiService: {
    getRatingsDistribution: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiService.getRatingsDistribution);

describe("useRatingsDistribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches all-time (no year) when passed null", async () => {
    mockGet.mockResolvedValue({ data: [{ rating: 4, count: 3 }] });

    const { result } = renderHook(() => useRatingsDistribution(null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGet).toHaveBeenCalledWith(undefined, expect.any(AbortSignal));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it("scopes to the given year", async () => {
    mockGet.mockResolvedValue({ data: [] });

    renderHook(() => useRatingsDistribution(2021));

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(2021, expect.any(AbortSignal)),
    );
  });

  it("sets an error when the request rejects", async () => {
    mockGet.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useRatingsDistribution(null));

    await waitFor(() => expect(result.current.error).not.toBeNull());
  });

  it("refetches when the year changes", async () => {
    mockGet.mockResolvedValue({ data: [] });

    const { rerender } = renderHook(({ y }) => useRatingsDistribution(y), {
      initialProps: { y: null as number | null },
    });

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
    rerender({ y: 2000 });
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(2000, expect.any(AbortSignal)),
    );
  });
});
