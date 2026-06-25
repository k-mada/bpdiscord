import { act, renderHook, waitFor } from "@testing-library/react";

import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { apiService } from "../services/api";
import { installFakeLocalStorage } from "./helpers/localStorage";
import type { CurrentUser } from "../types";

vi.mock("../services/api", () => ({
  apiService: {
    getCurrentUser: vi.fn(),
  },
}));

const mockUser: CurrentUser = {
  id: "auth-uuid",
  email: "user@example.test",
  role: "admin",
  lbusername: "someuser",
  displayName: "Some User",
};

const mockGetCurrentUser = vi.mocked(apiService.getCurrentUser);

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

describe("AuthProvider / useAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFakeLocalStorage();
  });

  it("starts logged-out and settled when no token is present", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it("resolves the current user from /me when a token exists at mount", async () => {
    localStorage.setItem("token", "valid-token");
    mockGetCurrentUser.mockResolvedValue({ data: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user).toEqual(mockUser));
    expect(result.current.token).toBe("valid-token");
    expect(mockGetCurrentUser).toHaveBeenCalledWith(
      "valid-token",
      expect.any(AbortSignal),
    );
    expect(result.current.loading).toBe(false);
  });

  it("login() persists the token and resolves the user (same tab, no reload)", async () => {
    mockGetCurrentUser.mockResolvedValue({ data: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.login("fresh-token"));

    await waitFor(() => expect(result.current.user).toEqual(mockUser));
    expect(localStorage.getItem("token")).toBe("fresh-token");
  });

  it("logout() clears the token, the legacy user blob, and the user", async () => {
    localStorage.setItem("token", "valid-token");
    localStorage.setItem("user", '{"id":"u1"}');
    mockGetCurrentUser.mockResolvedValue({ data: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(mockUser));

    act(() => result.current.logout());

    await waitFor(() => expect(result.current.user).toBeNull());
    expect(result.current.token).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("treats a 2xx /me without a user as no user", async () => {
    localStorage.setItem("token", "valid-token");
    mockGetCurrentUser.mockResolvedValue({ message: "ok" });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("sets an error and null user when /me fails, leaving the token in place", async () => {
    localStorage.setItem("token", "bad-token");
    mockGetCurrentUser.mockRejectedValue(new Error("Invalid or expired token"));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.user).toBeNull();
    // Parity with the old useUser: a failed /me does not force a logout.
    expect(result.current.token).toBe("bad-token");
  });

  it("syncs cross-tab: a storage event re-resolves identity from the new token", async () => {
    mockGetCurrentUser.mockResolvedValue({ data: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();

    act(() => {
      localStorage.setItem("token", "other-tab-token");
      window.dispatchEvent(
        new StorageEvent("storage", { key: "token", newValue: "other-tab-token" }),
      );
    });

    await waitFor(() => expect(result.current.user).toEqual(mockUser));
    expect(result.current.token).toBe("other-tab-token");
  });

  it("syncs cross-tab logout: a full-store clear drops the user", async () => {
    localStorage.setItem("token", "valid-token");
    mockGetCurrentUser.mockResolvedValue({ data: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).toEqual(mockUser));

    act(() => {
      localStorage.removeItem("token");
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });

    await waitFor(() => expect(result.current.user).toBeNull());
    expect(result.current.token).toBeNull();
  });

  it("throws when useAuth is used outside an AuthProvider", () => {
    expect(() => renderHook(() => useAuth())).toThrow(
      /must be used within an AuthProvider/,
    );
  });
});
