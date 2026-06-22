import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import ForgotPassword from "../components/ForgotPassword";
import apiService from "../services/api";

vi.mock("../services/api");

function renderPage() {
  return render(
    <MemoryRouter>
      <ForgotPassword />
    </MemoryRouter>,
  );
}

describe("ForgotPassword", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the email field and a back-to-login link", () => {
    renderPage();
    expect(screen.getByLabelText("Email Address")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Send Reset Email" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /back to login/i })).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("submits the email via apiService.requestPasswordReset and shows the server message", async () => {
    vi.mocked(apiService.requestPasswordReset).mockResolvedValue({
      message: "Password reset email sent. Please check your email.",
    });

    renderPage();
    await userEvent.type(screen.getByLabelText("Email Address"), "u@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Send Reset Email" }));

    expect(apiService.requestPasswordReset).toHaveBeenCalledWith("u@example.test");
    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
  });

  it("falls back to a default success message when the response has none", async () => {
    vi.mocked(apiService.requestPasswordReset).mockResolvedValue({});

    renderPage();
    await userEvent.type(screen.getByLabelText("Email Address"), "u@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Send Reset Email" }));

    await waitFor(() => {
      expect(
        screen.getByText("Password reset email sent. Please check your email."),
      ).toBeInTheDocument();
    });
  });

  it("displays an error when the request fails", async () => {
    vi.mocked(apiService.requestPasswordReset).mockRejectedValue(
      new Error("Too many requests"),
    );

    renderPage();
    await userEvent.type(screen.getByLabelText("Email Address"), "u@example.test");
    await userEvent.click(screen.getByRole("button", { name: "Send Reset Email" }));

    await waitFor(() => {
      expect(screen.getByText("Too many requests")).toBeInTheDocument();
    });
  });
});
