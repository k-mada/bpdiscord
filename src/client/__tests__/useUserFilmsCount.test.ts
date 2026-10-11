import { renderHook, waitFor } from "@testing-library/react";
import { useUserFilmsCount } from "../hooks/useUserFilmsCount";
import { apiService } from "../services/api";

vi.mock("../services/api", () => ({
  apiService: {
    getUserFilmsCount: vi.fn(),
  },
}));

const mockGet = vi.mocked(apiService.getUserFilmsCount);

describe("useUserFilmsCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches all-time (no year) when passed null", async () => {
    mockGet.mockResolvedValue({ data: 19 });

    const { result } = renderHook(() => useUserFilmsCount(null));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockGet).toHaveBeenCalledWith(undefined, expect.any(AbortSignal));
    expect(result.current.data).toBe(19);
    expect(result.current.error).toBeNull();
  });

  it("scopes to the given year", async () => {
    mockGet.mockResolvedValue({ data: 3 });

    renderHook(() => useUserFilmsCount(2021));

    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(2021, expect.any(AbortSignal)),
    );
  });

  it("starts with null data so the first load is distinguishable from 0", () => {
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useUserFilmsCount(null));

    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
  });

  it("sets an error when the request rejects", async () => {
    mockGet.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useUserFilmsCount(null));

    await waitFor(() => expect(result.current.error).not.toBeNull());
  });

  it("refetches when the year changes", async () => {
    mockGet.mockResolvedValue({ data: 1 });

    const { rerender } = renderHook(({ y }) => useUserFilmsCount(y), {
      initialProps: { y: null as number | null },
    });

    await waitFor(() => expect(mockGet).toHaveBeenCalledTimes(1));
    rerender({ y: 2000 });
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(2000, expect.any(AbortSignal)),
    );
  });

  it("keeps the previous count while a new year loads", async () => {
    mockGet.mockResolvedValue({ data: 19 });

    const { result, rerender } = renderHook(({ y }) => useUserFilmsCount(y), {
      initialProps: { y: null as number | null },
    });

    await waitFor(() => expect(result.current.data).toBe(19));

    // Next fetch is slow: the old count must stay visible, not drop to null.
    mockGet.mockReturnValueOnce(new Promise(() => {}));
    rerender({ y: 2000 });

    expect(result.current.data).toBe(19);
  });
});
