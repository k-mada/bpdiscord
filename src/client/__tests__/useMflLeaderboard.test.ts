import { renderHook, waitFor } from "@testing-library/react";
import { useMflLeaderboard } from "../hooks/useMflLeaderboard";
import apiService from "../services/api";
import type { MFLLeaderboardEntry } from "../types";

vi.mock("../services/api");

const mockLeaderboard: MFLLeaderboardEntry[] = [
  { rank: 1, lbusername: "rooney", displayName: "Rooney", totalPoints: 143 },
  { rank: 2, lbusername: "kevin", displayName: null, totalPoints: 98 },
];

describe("useMflLeaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts loading with an empty list", () => {
    vi.mocked(apiService.getMflLeaderboard).mockReturnValue(
      new Promise(() => {}),
    );

    const { result } = renderHook(() => useMflLeaderboard());

    expect(result.current.loading).toBe(true);
    expect(result.current.leaderboard).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("loads the ranked members on mount", async () => {
    vi.mocked(apiService.getMflLeaderboard).mockResolvedValue({
      data: mockLeaderboard,
    });

    const { result } = renderHook(() => useMflLeaderboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.leaderboard).toEqual(mockLeaderboard);
    expect(result.current.error).toBeNull();
    expect(apiService.getMflLeaderboard).toHaveBeenCalledTimes(1);
  });

  it("handles undefined data gracefully", async () => {
    vi.mocked(apiService.getMflLeaderboard).mockResolvedValue({});

    const { result } = renderHook(() => useMflLeaderboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.leaderboard).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("surfaces a fetch failure", async () => {
    vi.mocked(apiService.getMflLeaderboard).mockRejectedValue(
      new Error("Network error"),
    );

    const { result } = renderHook(() => useMflLeaderboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Failed to load standings");
    expect(result.current.leaderboard).toEqual([]);
  });
});
