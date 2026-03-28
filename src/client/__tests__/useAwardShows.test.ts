import { renderHook, waitFor, act } from "@testing-library/react";
import { useAwardShows } from "../hooks/useAwardShows";
import { apiService } from "../services/api";
import { describeFetchHookLifecycle } from "./helpers/hookTestFactory";

vi.mock("../services/api", () => ({
  apiService: {
    getAwardShows: vi.fn(),
    createAwardShow: vi.fn(),
  },
}));

const mockAwardShows = [
  {
    id: "uuid-1",
    name: "The Oscars",
    slug: "oscars",
    description: null,
  },
  {
    id: "uuid-2",
    name: "The Golden Globes",
    slug: "golden-globes",
    description: "Hollywood Foreign Press Awards",
  },
];

describe("useAwardShows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Standard fetch-on-mount lifecycle tests
  describeFetchHookLifecycle({
    name: "useAwardShows",
    useHook: () => useAwardShows(),
    dataField: "awardShows",
    mockFetchFn: vi.mocked(apiService.getAwardShows),
    mockData: mockAwardShows,
    wrapResponse: (data) => ({ data }),
    expectedError: "Failed to load award shows",
  });

  // Hook-specific: createAwardShow
  describe("createAwardShow", () => {
    it("creates an award show and refreshes the list", async () => {
      const newShow = {
        id: "uuid-3",
        name: "The Emmys",
        slug: "emmys",
        description: null,
      };

      vi.mocked(apiService.getAwardShows)
        .mockResolvedValueOnce({ data: mockAwardShows })
        .mockResolvedValueOnce({ data: [...mockAwardShows, newShow] });

      vi.mocked(apiService.createAwardShow).mockResolvedValue({
        data: newShow,
      });

      const { result } = renderHook(() => useAwardShows());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      let created: typeof newShow | undefined;
      await act(async () => {
        created = await result.current.createAwardShow(
          { name: "The Emmys", slug: "emmys" },
          "test-token"
        );
      });

      expect(apiService.createAwardShow).toHaveBeenCalledWith(
        { name: "The Emmys", slug: "emmys" },
        "test-token"
      );
      expect(created).toEqual(newShow);
      // Should have fetched twice: once on mount, once after create
      expect(apiService.getAwardShows).toHaveBeenCalledTimes(2);
      expect(result.current.awardShows).toHaveLength(3);
    });

    it("passes description when provided", async () => {
      vi.mocked(apiService.getAwardShows)
        .mockResolvedValueOnce({ data: mockAwardShows })
        .mockResolvedValueOnce({ data: mockAwardShows });

      vi.mocked(apiService.createAwardShow).mockResolvedValue({
        data: { id: "uuid-4", name: "BAFTAs", slug: "baftas", description: "British awards" },
      });

      const { result } = renderHook(() => useAwardShows());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await act(async () => {
        await result.current.createAwardShow(
          { name: "BAFTAs", slug: "baftas", description: "British awards" },
          "test-token"
        );
      });

      expect(apiService.createAwardShow).toHaveBeenCalledWith(
        { name: "BAFTAs", slug: "baftas", description: "British awards" },
        "test-token"
      );
    });

    it("propagates error when createAwardShow API fails", async () => {
      vi.mocked(apiService.getAwardShows).mockResolvedValue({
        data: mockAwardShows,
      });
      vi.mocked(apiService.createAwardShow).mockRejectedValue(
        new Error("Unauthorized")
      );

      const { result } = renderHook(() => useAwardShows());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      await expect(
        act(async () => {
          await result.current.createAwardShow(
            { name: "Test", slug: "test" },
            "bad-token"
          );
        })
      ).rejects.toThrow("Unauthorized");
    });
  });
});
