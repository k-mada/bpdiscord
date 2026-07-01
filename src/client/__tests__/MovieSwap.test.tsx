import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import MovieSwap from "../components/MovieSwap";
import { apiService } from "../services/api";
import type { MovieSwapResult } from "../../shared/types";

vi.mock("../services/api", () => ({
  apiService: {
    getMovieSwap: vi.fn(),
  },
}));

const mockGetMovieSwap = vi.mocked(apiService.getMovieSwap);

const renderSwap = () =>
  render(
    <MovieSwap
      user1="alice"
      user2="bob"
      user1Label="Alice"
      user2Label="Bob"
    />,
  );

describe("MovieSwap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders both directional lists with titles", async () => {
    const data: MovieSwapResult = {
      recsForUserA: [{ film_slug: "heat", title: "Heat", user_rating: 5 }],
      recsForUserB: [{ film_slug: "tenet", title: "Tenet", user_rating: 4 }],
    };
    mockGetMovieSwap.mockResolvedValue({ data });

    renderSwap();

    await waitFor(() =>
      expect(screen.getByText("Heat")).toBeInTheDocument(),
    );
    expect(screen.getByText("Tenet")).toBeInTheDocument();
    // The rating column names the seer (headerContext-driven label).
    expect(screen.getByText("Bob's rating")).toBeInTheDocument();
    expect(screen.getByText("Alice's rating")).toBeInTheDocument();
  });

  it("renders an unrated film as 'not rated', not zero stars", async () => {
    const data: MovieSwapResult = {
      recsForUserA: [{ film_slug: "tenet", title: "Tenet", user_rating: null }],
      recsForUserB: [],
    };
    mockGetMovieSwap.mockResolvedValue({ data });

    renderSwap();

    await waitFor(() =>
      expect(screen.getByText("not rated")).toBeInTheDocument(),
    );
  });

  it("shows an empty state for a direction with no films", async () => {
    const data: MovieSwapResult = { recsForUserA: [], recsForUserB: [] };
    mockGetMovieSwap.mockResolvedValue({ data });

    renderSwap();

    await waitFor(() =>
      expect(screen.getAllByText("Nothing to recommend.")).toHaveLength(2),
    );
  });

  it("surfaces an error when the request fails", async () => {
    mockGetMovieSwap.mockRejectedValue(new Error("boom"));

    renderSwap();

    await waitFor(() =>
      expect(screen.getByText("Failed to load movie swap")).toBeInTheDocument(),
    );
  });

  it("defaults to rating order (desc, unrated last), sorting client-side", async () => {
    mockGetMovieSwap.mockResolvedValue({
      data: {
        recsForUserA: [
          { film_slug: "amelie", title: "Amelie", user_rating: 3 },
          { film_slug: "zodiac", title: "Zodiac", user_rating: 5 },
          { film_slug: "tenet", title: "Tenet", user_rating: null },
        ],
        recsForUserB: [],
      },
    });
    renderSwap();

    await waitFor(() =>
      expect(screen.getByText("Zodiac")).toBeInTheDocument(),
    );
    const titles = () =>
      screen.getAllByRole("link").map((a) => a.textContent);
    expect(titles()).toEqual(["Zodiac", "Amelie", "Tenet"]);
  });

  it("toggles between Rating and A–Z order", async () => {
    mockGetMovieSwap.mockResolvedValue({
      data: {
        recsForUserA: [
          { film_slug: "amelie", title: "Amelie", user_rating: 3 },
          { film_slug: "zodiac", title: "Zodiac", user_rating: 5 },
          { film_slug: "tenet", title: "Tenet", user_rating: null },
        ],
        recsForUserB: [],
      },
    });
    renderSwap();
    await waitFor(() =>
      expect(screen.getByText("Zodiac")).toBeInTheDocument(),
    );
    const titles = () =>
      screen.getAllByRole("link").map((a) => a.textContent);

    fireEvent.click(screen.getByRole("button", { name: /A.Z/ }));
    expect(titles()).toEqual(["Amelie", "Tenet", "Zodiac"]);

    fireEvent.click(screen.getByRole("button", { name: "Rating" }));
    expect(titles()).toEqual(["Zodiac", "Amelie", "Tenet"]);
  });
});
