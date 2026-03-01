import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import HaterRankings from "./HaterRankings";
import apiService from "../services/api";

vi.mock("../services/api");
vi.mock("./RatingDistributionHistogram", () => ({
  default: () => <div data-testid="histogram" />,
}));
vi.mock("./Header", () => ({
  default: () => <header data-testid="header" />,
}));
vi.mock("./Spinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

const mockRankings = [
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

function renderComponent(props = {}) {
  return render(
    <MemoryRouter>
      <HaterRankings {...props} />
    </MemoryRouter>
  );
}

describe("HaterRankings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("loading state", () => {
    it("shows spinner while loading", () => {
      vi.mocked(apiService.getHaterRankings).mockReturnValue(
        new Promise(() => {})
      );

      renderComponent();

      expect(screen.getByTestId("spinner")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("displays error message when API call fails", async () => {
      vi.mocked(apiService.getHaterRankings).mockRejectedValue(
        new Error("Network error")
      );

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load hater rankings")
        ).toBeInTheDocument();
      });
    });

    it("shows a retry button on error", async () => {
      vi.mocked(apiService.getHaterRankings).mockRejectedValue(
        new Error("Network error")
      );

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Try Again")).toBeInTheDocument();
      });
    });

    it("retries fetching when Try Again is clicked", async () => {
      vi.mocked(apiService.getHaterRankings)
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({ data: mockRankings });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Try Again")).toBeInTheDocument();
      });

      await userEvent.click(screen.getByText("Try Again"));

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
      });

      expect(apiService.getHaterRankings).toHaveBeenCalledTimes(2);
    });
  });

  describe("empty state", () => {
    it("displays empty message when no rankings exist", async () => {
      vi.mocked(apiService.getHaterRankings).mockResolvedValue({ data: [] });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText(/No user ratings found/)
        ).toBeInTheDocument();
      });
    });
  });

  describe("with data", () => {
    beforeEach(() => {
      vi.mocked(apiService.getHaterRankings).mockResolvedValue({
        data: mockRankings,
      });
    });

    it("renders the heading and subheading", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Hater Rankings")).toBeInTheDocument();
      });

      expect(
        screen.getByText("Users ranked by average movie rating (lowest first)")
      ).toBeInTheDocument();
    });

    it("renders all table headers", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Rank")).toBeInTheDocument();
      });

      expect(screen.getByText("User")).toBeInTheDocument();
      expect(screen.getByText("Total Movies Rated")).toBeInTheDocument();
      expect(screen.getByText("Average Rating")).toBeInTheDocument();
      expect(screen.getByText("Rating Distribution")).toBeInTheDocument();
    });

    it("renders user rankings with correct data", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
      });

      expect(screen.getByText("Bob")).toBeInTheDocument();
      expect(screen.getByText("100")).toBeInTheDocument();
      expect(screen.getByText("200")).toBeInTheDocument();
      expect(screen.getByText("2.50 / 5.0")).toBeInTheDocument();
      expect(screen.getByText("3.75 / 5.0")).toBeInTheDocument();
    });

    it("shows user count summary", async () => {
      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText("Showing 2 users with ratings data")
        ).toBeInTheDocument();
      });
    });

    it("shows singular 'user' when only one ranking", async () => {
      vi.mocked(apiService.getHaterRankings).mockResolvedValue({
        data: [mockRankings[0]!],
      });

      renderComponent();

      await waitFor(() => {
        expect(
          screen.getByText("Showing 1 user with ratings data")
        ).toBeInTheDocument();
      });
    });

    it("links usernames to Letterboxd profiles", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
      });

      const aliceLink = screen.getByText("Alice").closest("a");
      expect(aliceLink).toHaveAttribute(
        "href",
        "https://letterboxd.com/alice"
      );
      expect(aliceLink).toHaveAttribute("target", "_blank");
    });

    it("falls back to username when displayName is missing", async () => {
      vi.mocked(apiService.getHaterRankings).mockResolvedValue({
        data: [
          { username: "nodisplay", averageRating: 3.0, totalRatings: 50 },
        ],
      });

      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("nodisplay")).toBeInTheDocument();
      });
    });

    it("renders histogram for each user", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Alice")).toBeInTheDocument();
      });

      expect(screen.getAllByTestId("histogram")).toHaveLength(2);
    });
  });

  describe("public vs dashboard layout", () => {
    beforeEach(() => {
      vi.mocked(apiService.getHaterRankings).mockResolvedValue({
        data: mockRankings,
      });
    });

    it("renders Header when isPublic is true", async () => {
      renderComponent({ isPublic: true });

      await waitFor(() => {
        expect(screen.getByTestId("header")).toBeInTheDocument();
      });
    });

    it("does not render Header when isPublic is false", async () => {
      renderComponent({ isPublic: false });

      await waitFor(() => {
        expect(screen.getByText("Hater Rankings")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("header")).not.toBeInTheDocument();
    });

    it("does not render Header by default", async () => {
      renderComponent();

      await waitFor(() => {
        expect(screen.getByText("Hater Rankings")).toBeInTheDocument();
      });

      expect(screen.queryByTestId("header")).not.toBeInTheDocument();
    });
  });
});
