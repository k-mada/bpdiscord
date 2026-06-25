import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import LoginPage from "../components/LoginPage";
import apiService from "../services/api";
import { AuthProvider } from "../contexts/AuthContext";
import { installFakeLocalStorage } from "./helpers/localStorage";

vi.mock("../services/api");
vi.mock("../components/Subheading", () => ({
  Subheading: () => <div data-testid="subheading" />,
}));

function renderPage() {
  return render(
    <AuthProvider>
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("LoginPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFakeLocalStorage();
    // AuthProvider resolves /me after login(); keep it a no-op here.
    vi.mocked(apiService.getCurrentUser).mockResolvedValue({});
  });

  it("renders email + password fields (no name field)", () => {
    renderPage();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.queryByLabelText("Name")).not.toBeInTheDocument();
  });

  it("renders the Sign Up link to /signup", () => {
    renderPage();
    const link = screen.getByRole("link", { name: /sign up/i });
    expect(link).toHaveAttribute("href", "/signup");
  });

  it("renders the Forgot password link to /forgot-password", () => {
    renderPage();
    const link = screen.getByRole("link", { name: /forgot your password/i });
    expect(link).toHaveAttribute("href", "/forgot-password");
  });

  it("submits via apiService.login and persists the token via AuthProvider", async () => {
    vi.mocked(apiService.login).mockResolvedValue({
      data: {
        message: "ok",
        access_token: "fake-token",
        user: { id: "u1", email: "u@example.test" } as never,
      },
    });

    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "u@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(localStorage.getItem("token")).toBe("fake-token");
    });
    expect(apiService.login).toHaveBeenCalledWith({
      email: "u@example.test",
      password: "secret",
    });
    // The legacy cached blob is no longer written — /me is the source of truth.
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("displays a form-level error when login fails", async () => {
    vi.mocked(apiService.login).mockRejectedValue(new Error("Invalid credentials"));

    renderPage();
    await userEvent.type(screen.getByLabelText("Email"), "u@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "wrong");
    await userEvent.click(screen.getByRole("button", { name: "Login" }));

    await waitFor(() => {
      expect(screen.getByText("Invalid credentials")).toBeInTheDocument();
    });
    expect(localStorage.getItem("token")).toBeNull();
  });
});
