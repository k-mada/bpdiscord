import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import SignupPage from "../components/SignupPage";
import apiService from "../services/api";
import { installFakeLocalStorage } from "./helpers/localStorage";

vi.mock("../services/api");
vi.mock("../components/Subheading", () => ({
  Subheading: () => <div data-testid="subheading" />,
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <SignupPage />
    </MemoryRouter>,
  );
}

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFakeLocalStorage();
  });

  it("renders name + email + password fields (no lbusername yet)", () => {
    renderPage();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.queryByLabelText(/letterboxd/i)).not.toBeInTheDocument();
  });

  it("renders the Login link to /login", () => {
    renderPage();
    const link = screen.getByRole("link", { name: /login/i });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("submits via apiService.signup and persists token + user when present", async () => {
    vi.mocked(apiService.signup).mockResolvedValue({
      data: {
        message: "ok",
        access_token: "fake-token",
        user: { id: "u1", email: "u@example.test" } as never,
      },
    });

    renderPage();
    await userEvent.type(screen.getByLabelText("Name"), "New User");
    await userEvent.type(screen.getByLabelText("Email"), "u@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => {
      expect(localStorage.getItem("token")).toBe("fake-token");
    });
    expect(apiService.signup).toHaveBeenCalledWith({
      name: "New User",
      email: "u@example.test",
      password: "secret",
    });
  });

  it("surfaces server message when signup returns no access_token (e.g. email confirmation flow)", async () => {
    vi.mocked(apiService.signup).mockResolvedValue({
      message: "Account created. Please check your email to confirm your account before signing in.",
    });

    renderPage();
    await userEvent.type(screen.getByLabelText("Name"), "Confirm Me");
    await userEvent.type(screen.getByLabelText("Email"), "u@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("displays a form-level error when signup fails", async () => {
    vi.mocked(apiService.signup).mockRejectedValue(new Error("Email already in use"));

    renderPage();
    await userEvent.type(screen.getByLabelText("Name"), "Dup");
    await userEvent.type(screen.getByLabelText("Email"), "dup@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => {
      expect(screen.getByText("Email already in use")).toBeInTheDocument();
    });
    expect(localStorage.getItem("token")).toBeNull();
  });
});
