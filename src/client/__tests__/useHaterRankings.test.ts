import { renderHook, waitFor, act } from "@testing-library/react";
import { useHaterRankings, useHaterRankings2 } from "../hooks/useHaterRankings";
import apiService from "../services/api";
import { describeFetchHookLifecycle } from "./helpers/hookTestFactory";

vi.mock("../services/api");

const mockRankingsV1 = [
  {
    username: "alice",
    displayName: "Alice",
    averageRating: 2.5,
    totalRatings: 100,
    ratingDistribution: [
      { rating: 1, count: 20 },
      { rating: 3, count: 50 },
      { rating: 5, count: 30 },
    ],
  },
  {
    username: "bob",
    displayName: "Bob",
    averageRating: 3.75,
    totalRatings: 200,
    ratingDistribution: [
      { rating: 2, count: 40 },
      { rating: 4, count: 160 },
    ],
  },
];

const mockRankingsV2 = [
  {
    username: "alice",
    displayName: "Alice",
    filmsRated: 100,
    differential: -50.0,
    adjustedDifferential: -25.0,
  },
  {
    username: "bob",
    displayName: "Bob",
    filmsRated: 200,
    differential: 30.0,
    adjustedDifferential: 15.0,
  },
];

describe("useHaterRankings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Standard fetch-on-mount lifecycle tests
  describeFetchHookLifecycle({
    name: "useHaterRankings",
    useHook: () => useHaterRankings(),
    dataField: "rankings",
    mockFetchFn: vi.mocked(apiService.getHaterRankings),
    mockData: mockRankingsV1,
    wrapResponse: (data) => ({ data }),
    expectedError: "Failed to load hater rankings",
  });

  // Hook-specific: loading flag during refetch
  describe("refetch loading state", () => {
    it("sets loading to true during refetch", async () => {
      let resolveSecondCall: (value: unknown) => void;
      const secondCallPromise = new Promise((resolve) => {
        resolveSecondCall = resolve;
      });

      vi.mocked(apiService.getHaterRankings)
        .mockResolvedValueOnce({ data: mockRankingsV1 })
        .mockReturnValueOnce(secondCallPromise as ReturnType<typeof apiService.getHaterRankings>);

      const { result } = renderHook(() => useHaterRankings());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      act(() => {
        result.current.refetch();
      });

      await waitFor(() => {
        expect(result.current.loading).toBe(true);
      });

      await act(async () => {
        resolveSecondCall!({ data: mockRankingsV1 });
      });

      expect(result.current.loading).toBe(false);
    });
  });
});

describe("useHaterRankings2", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Standard fetch-on-mount lifecycle tests
  describeFetchHookLifecycle({
    name: "useHaterRankings2",
    useHook: () => useHaterRankings2(),
    dataField: "rankings",
    mockFetchFn: vi.mocked(apiService.getHaterRankings2),
    mockData: mockRankingsV2,
    wrapResponse: (data) => ({ data }),
    expectedError: "Failed to load hater rankings",
  });
});
