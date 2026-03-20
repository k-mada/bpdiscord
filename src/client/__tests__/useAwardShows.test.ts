import { renderHook, waitFor, act } from "@testing-library/react";
import { useAwardShows } from "../hooks/useAwardShows";
import { apiService } from "../services/api";

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

  describe("initial fetch", () => {
    it("starts in a loading state with empty award shows", () => {
      vi.mocked(apiService.getAwardShows).mockReturnValue(
        new Promise(() => {})
      );

      const { result } = renderHook(() => useAwardShows());

      expect(result.current.loading).toBe(true);
      expect(result.current.awardShows).toEqual([]);
      expect(result.current.error).toBeNull();
    });

    it("fetches award shows on mount and sets data", async () => {
      vi.mocked(apiService.getAwardShows).mockResolvedValue({
        data: mockAwardShows,
      });

      const { result } = renderHook(() => useAwardShows());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.awardShows).toEqual(mockAwardShows);
      expect(result.current.error).toBeNull();
      expect(apiService.getAwardShows).toHaveBeenCalledTimes(1);
    });

    it("handles undefined data gracefully", async () => {
      vi.mocked(apiService.getAwardShows).mockResolvedValue({
        data: undefined,
      });

      const { result } = renderHook(() => useAwardShows());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.awardShows).toEqual([]);
      expect(result.current.error).toBeNull();
    });
  });

  describe("error handling", () => {
    it("sets error when API call fails", async () => {
      vi.mocked(apiService.getAwardShows).mockRejectedValue(
        new Error("Network error")
      );

      const { result } = renderHook(() => useAwardShows());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe("Failed to load award shows");
      expect(result.current.awardShows).toEqual([]);
    });

    it("clears previous error on successful refetch", async () => {
      vi.mocked(apiService.getAwardShows)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ data: mockAwardShows });

      const { result } = renderHook(() => useAwardShows());

      await waitFor(() => {
        expect(result.current.error).toBe("Failed to load award shows");
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.error).toBeNull();
      expect(result.current.awardShows).toEqual(mockAwardShows);
    });
  });

  describe("refetch", () => {
    it("refetches data when refetch is called", async () => {
      const updatedShows = [...mockAwardShows, {
        id: "uuid-3",
        name: "The Emmys",
        slug: "emmys",
        description: null,
      }];

      vi.mocked(apiService.getAwardShows)
        .mockResolvedValueOnce({ data: mockAwardShows })
        .mockResolvedValueOnce({ data: updatedShows });

      const { result } = renderHook(() => useAwardShows());

      await waitFor(() => {
        expect(result.current.awardShows).toEqual(mockAwardShows);
      });

      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.awardShows).toEqual(updatedShows);
      expect(apiService.getAwardShows).toHaveBeenCalledTimes(2);
    });
  });

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

      let created: any;
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
