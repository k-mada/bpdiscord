/**
 * Shared test factory for hooks that follow the standard fetch-on-mount pattern:
 *   { data, loading, error, refetch }
 *
 * Generates the standard lifecycle tests (initial loading, success, undefined data,
 * error, error clearing on refetch, refetch replacing data) so individual test files
 * only need to add tests for hook-specific behavior.
 */
import { renderHook, waitFor, act } from "@testing-library/react";

interface FetchHookConfig<TData> {
  /** Human-readable hook name, e.g. "useHaterRankings" */
  name: string;
  /** The hook function to render */
  useHook: () => {
    loading: boolean;
    error: string | null;
    refetch: () => Promise<void>;
    [key: string]: unknown;
  };
  /** Field name on the hook return that holds the data, e.g. "rankings" */
  dataField: string;
  /** The mock function that the hook calls on mount */
  mockFetchFn: ReturnType<typeof vi.fn>;
  /** Mock data for the successful case */
  mockData: TData;
  /** What the API response looks like when wrapping data */
  wrapResponse: (data: TData | undefined) => unknown;
  /** Expected error message when fetch fails */
  expectedError: string;
}

/**
 * Generates standard lifecycle tests for a fetch-on-mount hook.
 * Call inside a `describe("hookName")` block — it creates nested describes
 * so failures show the full path, e.g.:
 *   "useHaterRankings > initial fetch > starts in a loading state"
 */
export function describeFetchHookLifecycle<TData>(config: FetchHookConfig<TData>) {
  const {
    useHook,
    dataField,
    mockFetchFn,
    mockData,
    wrapResponse,
    expectedError,
  } = config;

  describe("initial fetch", () => {
    it("starts in a loading state", () => {
      mockFetchFn.mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(useHook);

      expect(result.current.loading).toBe(true);
      expect(result.current[dataField]).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("fetches data on mount and sets it", async () => {
      mockFetchFn.mockResolvedValue(wrapResponse(mockData));

      const { result } = renderHook(useHook);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current[dataField]).toEqual(mockData);
      expect(result.current.error).toBeNull();
      expect(mockFetchFn).toHaveBeenCalledTimes(1);
    });

    it("handles undefined data gracefully", async () => {
      mockFetchFn.mockResolvedValue(wrapResponse(undefined));

      const { result } = renderHook(useHook);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current[dataField]).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe("error handling", () => {
    it("sets error when API call fails", async () => {
      mockFetchFn.mockRejectedValue(new Error("Network error"));

      const { result } = renderHook(useHook);

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe(expectedError);
      expect(result.current[dataField]).toEqual([]);
    });

    it("clears previous error on successful refetch", async () => {
      mockFetchFn
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce(wrapResponse(mockData));

      const { result } = renderHook(useHook);

      await waitFor(() => {
        expect(result.current.error).toBe(expectedError);
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeNull();
      expect(result.current[dataField]).toEqual(mockData);
    });
  });

  describe("refetch", () => {
    it("replaces data when refetch is called", async () => {
      const slicedData = Array.isArray(mockData) ? [mockData[0]] : mockData;

      mockFetchFn
        .mockResolvedValueOnce(wrapResponse(mockData))
        .mockResolvedValueOnce(wrapResponse(slicedData as TData));

      const { result } = renderHook(useHook);

      await waitFor(() => {
        expect(result.current[dataField]).toEqual(mockData);
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current[dataField]).toEqual(slicedData);
      expect(mockFetchFn).toHaveBeenCalledTimes(2);
    });
  });
}
