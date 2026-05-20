import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import ResetPasswordPage from "../components/ResetPasswordPage";
import { supabase } from "../lib/supabase";
import { installFakeLocalStorage } from "./helpers/localStorage";

// Mock the Supabase client. The page touches getSession, updateUser, signOut.
vi.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: vi.fn(),
      updateUser: vi.fn(),
      signOut: vi.fn(),
    },
  },
}));
vi.mock("../components/Subheading", () => ({
  Subheading: () => <div data-testid="subheading" />,
}));

// Test harness that captures location.state on /login navigation so we can
// assert the resetSuccess flag passed forward.
function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="probe">
      <span data-testid="pathname">{location.pathname}</span>
      <span data-testid="state">{JSON.stringify(location.state ?? null)}</span>
    </div>
  );
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/reset-password"]}>
      <Routes>
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/login" element={<LocationProbe />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ResetPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFakeLocalStorage();
  });

  it("shows 'Verifying...' immediately on mount", () => {
    vi.mocked(supabase.auth.getSession).mockReturnValue(
      new Promise(() => {}) as never,
    );
    renderPage();
    expect(screen.getByText(/verifying your reset link/i)).toBeInTheDocument();
  });

  it("renders 'invalid or expired' when no session is present after URL parsing", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: null },
      error: null,
    } as never);

    renderPage();

    await waitFor(() => {
      expect(
        screen.getByText(/this reset link is invalid or has expired/i),
      ).toBeInTheDocument();
    });
    // No password form should be rendered in the invalid state.
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
    // updateUser should never be called when there's no session.
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("renders the password form when the session is valid", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: {
        session: {
          access_token: "recovery-token",
          user: { id: "u1" },
        },
      },
      error: null,
    } as never);

    renderPage();

    await waitFor(() => {
      expect(screen.getByLabelText("New Password")).toBeInTheDocument();
    });
    expect(screen.getByLabelText("Confirm New Password")).toBeInTheDocument();
  });

  it("rejects submit when passwords do not match (no SDK call)", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: "x", user: { id: "u1" } } },
      error: null,
    } as never);

    renderPage();
    await waitFor(() => screen.getByLabelText("New Password"));

    await userEvent.type(screen.getByLabelText("New Password"), "abcdef");
    await userEvent.type(
      screen.getByLabelText("Confirm New Password"),
      "abcdez",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    await waitFor(() => {
      expect(screen.getByText(/passwords do not match/i)).toBeInTheDocument();
    });
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("rejects submit when password is shorter than 6 chars (no SDK call)", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: "x", user: { id: "u1" } } },
      error: null,
    } as never);

    renderPage();
    await waitFor(() => screen.getByLabelText("New Password"));

    await userEvent.type(screen.getByLabelText("New Password"), "abc");
    await userEvent.type(screen.getByLabelText("Confirm New Password"), "abc");
    await userEvent.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    await waitFor(() => {
      expect(
        screen.getByText(/password must be at least 6 characters/i),
      ).toBeInTheDocument();
    });
    expect(supabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it("calls updateUser + signOut + clears app-level auth + navigates to /login with resetSuccess", async () => {
    // Seed stale app-level auth (simulates user being logged in before they
    // clicked the reset link).
    localStorage.setItem("token", "stale-token");
    localStorage.setItem("user", '{"id":"u1"}');

    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: "x", user: { id: "u1" } } },
      error: null,
    } as never);
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: { id: "u1" } },
      error: null,
    } as never);
    vi.mocked(supabase.auth.signOut).mockResolvedValue({
      error: null,
    } as never);

    renderPage();
    await waitFor(() => screen.getByLabelText("New Password"));

    await userEvent.type(screen.getByLabelText("New Password"), "n3wP@ss1");
    await userEvent.type(
      screen.getByLabelText("Confirm New Password"),
      "n3wP@ss1",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    await waitFor(() => {
      expect(screen.getByTestId("pathname").textContent).toBe("/login");
    });
    expect(supabase.auth.updateUser).toHaveBeenCalledWith({
      password: "n3wP@ss1",
    });
    expect(supabase.auth.signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("state").textContent).toContain(
      '"resetSuccess":true',
    );
    // Stale app-level auth is cleared so the user re-logs in cleanly.
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("surfaces an inline error when updateUser fails (no signOut, no navigation)", async () => {
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: "x", user: { id: "u1" } } },
      error: null,
    } as never);
    vi.mocked(supabase.auth.updateUser).mockResolvedValue({
      data: { user: null },
      error: { message: "Weak password" },
    } as never);

    renderPage();
    await waitFor(() => screen.getByLabelText("New Password"));

    await userEvent.type(screen.getByLabelText("New Password"), "abcdef");
    await userEvent.type(
      screen.getByLabelText("Confirm New Password"),
      "abcdef",
    );
    await userEvent.click(
      screen.getByRole("button", { name: /update password/i }),
    );

    await waitFor(() => {
      expect(screen.getByText("Weak password")).toBeInTheDocument();
    });
    expect(supabase.auth.signOut).not.toHaveBeenCalled();
    expect(screen.queryByTestId("pathname")).not.toBeInTheDocument();
  });
});
