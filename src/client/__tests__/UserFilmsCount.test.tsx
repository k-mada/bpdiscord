import { render, screen, waitFor } from "@testing-library/react";
import UserFilmsCount from "../components/UserFilmsCount";
import apiService from "../services/api";

vi.mock("../services/api");
vi.mock("../components/Spinner", () => ({
  default: () => <div data-testid="spinner" />,
}));

describe("UserFilmsCount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the heading", async () => {
    vi.mocked(apiService.getUserFilmsCount).mockResolvedValue({ data: 42 });

    render(<UserFilmsCount />);

    expect(
      screen.getByText("Movies watched by this Discord:"),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText("42")).toBeInTheDocument();
    });
  });

  describe("loading state", () => {
    it("shows the spinner while the request is in flight", () => {
      vi.mocked(apiService.getUserFilmsCount).mockReturnValue(
        new Promise(() => {}),
      );

      render(<UserFilmsCount />);

      expect(screen.getByTestId("spinner")).toBeInTheDocument();
    });
  });

  describe("error state", () => {
    it("displays an error message when the API call fails", async () => {
      vi.mocked(apiService.getUserFilmsCount).mockRejectedValue(
        new Error("Network error"),
      );

      render(<UserFilmsCount />);

      await waitFor(() => {
        expect(
          screen.getByText("Failed to load user films count"),
        ).toBeInTheDocument();
      });
    });

    it("does not display the count on error", async () => {
      vi.mocked(apiService.getUserFilmsCount).mockRejectedValue(
        new Error("Network error"),
      );

      render(<UserFilmsCount />);

      await waitFor(() => {
        expect(screen.getByRole("alert")).toBeInTheDocument();
      });

      // The count span should not be in the document while the error is shown.
      expect(screen.queryByTestId("user-films-count")).not.toBeInTheDocument();
    });
  });

  describe("success state", () => {
    it("renders the count returned by the API", async () => {
      vi.mocked(apiService.getUserFilmsCount).mockResolvedValue({ data: 42 });

      render(<UserFilmsCount />);

      await waitFor(() => {
        expect(screen.getByText("42")).toBeInTheDocument();
      });
    });

    it("renders 0 when the API returns 0", async () => {
      vi.mocked(apiService.getUserFilmsCount).mockResolvedValue({ data: 0 });

      render(<UserFilmsCount />);

      await waitFor(() => {
        expect(screen.queryByTestId("spinner")).not.toBeInTheDocument();
      });

      expect(screen.getByText("0")).toBeInTheDocument();
    });
  });
});
