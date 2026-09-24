import { renderHook, waitFor } from "@testing-library/react";
import { useMflLeaderboard } from "../hooks/useMflLeaderboard";
import apiService from "../services/api";
import type { MFLLeaderboardEntry } from "../types";

vi.mock("../services/api");

const official: MFLLeaderboardEntry[] = [
  { rank: 1, rosterId: 1, name: "My Picks", lbusername: "rooney", displayName: "Rooney", totalPoints: 143 },
];
const all: MFLLeaderboardEntry[] = [
  ...official,
  { rank: 2, rosterId: 2, name: "Backup", lbusername: "kevin", displayName: null, totalPoints: 98 },
];

describe("useMflLeaderboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts loading with empty lists", () => {
    vi.mocked(apiService.getMflLeaderboard).mockReturnValue(
      new Promise(() => {}),
    );

    const { result } = renderHook(() => useMflLeaderboard());

    expect(result.current.loading).toBe(true);
    expect(result.current.official).toEqual([]);
    expect(result.current.all).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("loads both ranked lists on mount", async () => {
    vi.mocked(apiService.getMflLeaderboard).mockResolvedValue({
      data: { official, all },
    });

    const { result } = renderHook(() => useMflLeaderboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.official).toEqual(official);
    expect(result.current.all).toEqual(all);
    expect(result.current.error).toBeNull();
    expect(apiService.getMflLeaderboard).toHaveBeenCalledTimes(1);
  });

  it("handles undefined data gracefully", async () => {
    vi.mocked(apiService.getMflLeaderboard).mockResolvedValue({});

    const { result } = renderHook(() => useMflLeaderboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.official).toEqual([]);
    expect(result.current.all).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it("surfaces a fetch failure", async () => {
    vi.mocked(apiService.getMflLeaderboard).mockRejectedValue(
      new Error("Network error"),
    );

    const { result } = renderHook(() => useMflLeaderboard());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Failed to load standings");
    expect(result.current.official).toEqual([]);
    expect(result.current.all).toEqual([]);
  });
});
