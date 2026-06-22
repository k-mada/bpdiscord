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

  it("renders name + email + password + Letterboxd.com username fields", () => {
    renderPage();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByLabelText("Letterboxd.com username")).toBeInTheDocument();
    expect(
      screen.getByText(/Optional — link your Letterboxd account now/),
    ).toBeInTheDocument();
  });

  it("renders the Login link to /login", () => {
    renderPage();
    const link = screen.getByRole("link", { name: /login/i });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("submits without lbusername when the field is left blank", async () => {
    vi.mocked(apiService.signup).mockResolvedValue({
      data: {
        message: "ok",
        access_token: "fake-token",
        user: { id: "u1", email: "u@example.test" } as never,
      },
    });

    const onAuthChange = vi.fn();
    window.addEventListener("authchange", onAuthChange);

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
    // Notifies useUser listeners (e.g. Header) to re-sync the new user.
    expect(onAuthChange).toHaveBeenCalledTimes(1);
    window.removeEventListener("authchange", onAuthChange);
  });

  it("trims, lowercases, and includes lbusername when provided", async () => {
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
    await userEvent.type(
      screen.getByLabelText("Letterboxd.com username"),
      "  DavidEhrlich  ",
    );
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() =>
      expect(apiService.signup).toHaveBeenCalledWith({
        name: "New User",
        email: "u@example.test",
        password: "secret",
        lbusername: "davidehrlich",
      }),
    );
  });

  it("blocks submission and shows an inline error on invalid lbusername format", async () => {
    renderPage();
    await userEvent.type(screen.getByLabelText("Name"), "x");
    await userEvent.type(screen.getByLabelText("Email"), "x@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.type(
      screen.getByLabelText("Letterboxd.com username"),
      "!!!",
    );
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(apiService.signup).not.toHaveBeenCalled();
    expect(
      screen.getByText(/2.15 characters/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Letterboxd.com username")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("routes a 409-claimed-conflict to the inline lbusername error", async () => {
    vi.mocked(apiService.signup).mockRejectedValue(
      new Error("This Letterboxd.com username has already been claimed."),
    );

    renderPage();
    await userEvent.type(screen.getByLabelText("Name"), "Late");
    await userEvent.type(screen.getByLabelText("Email"), "late@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.type(
      screen.getByLabelText("Letterboxd.com username"),
      "popular-name",
    );
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => {
      expect(
        screen.getByText(/already been claimed/),
      ).toBeInTheDocument();
    });
    expect(localStorage.getItem("token")).toBeNull();
  });

  it("clears the inline lbusername error when the user edits the field", async () => {
    renderPage();
    await userEvent.type(
      screen.getByLabelText("Letterboxd.com username"),
      "!!!",
    );
    await userEvent.type(screen.getByLabelText("Name"), "x");
    await userEvent.type(screen.getByLabelText("Email"), "x@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    expect(screen.getByText(/2.15 characters/)).toBeInTheDocument();

    await userEvent.type(
      screen.getByLabelText("Letterboxd.com username"),
      "a",
    );
    expect(screen.queryByText(/2.15 characters/)).not.toBeInTheDocument();
  });

  it("surfaces server message when signup returns no access_token (e.g. email confirmation flow)", async () => {
    vi.mocked(apiService.signup).mockResolvedValue({
      message: "Account created. Please check your email to confirm your account before signing in.",
    });

    const onAuthChange = vi.fn();
    window.addEventListener("authchange", onAuthChange);

    renderPage();
    await userEvent.type(screen.getByLabelText("Name"), "Confirm Me");
    await userEvent.type(screen.getByLabelText("Email"), "u@example.test");
    await userEvent.type(screen.getByLabelText("Password"), "secret");
    await userEvent.click(screen.getByRole("button", { name: "Sign Up" }));

    await waitFor(() => {
      expect(screen.getByText(/check your email/i)).toBeInTheDocument();
    });
    expect(localStorage.getItem("token")).toBeNull();
    // No token issued (email-confirmation flow) → no auth state to broadcast.
    expect(onAuthChange).not.toHaveBeenCalled();
    window.removeEventListener("authchange", onAuthChange);
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
