import { act, renderHook, waitFor } from "@testing-library/react";

import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { apiService } from "../services/api";
import { ApiError } from "../lib/apiError";
import { installFakeLocalStorage } from "./helpers/localStorage";
import { futureJwt, expiredJwt } from "./helpers/jwt";
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

  it("resolves the current user from /me when a live token exists at mount", async () => {
    const token = futureJwt();
    localStorage.setItem("token", token);
    mockGetCurrentUser.mockResolvedValue({ data: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.user).toEqual(mockUser));
    expect(result.current.token).toBe(token);
    expect(mockGetCurrentUser).toHaveBeenCalledWith(
      token,
      expect.any(AbortSignal),
    );
    expect(result.current.loading).toBe(false);
  });

  it("clears an already-expired token at mount without calling /me", async () => {
    localStorage.setItem("token", expiredJwt());
    localStorage.setItem("user", '{"id":"u1"}');

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.token).toBeNull();
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it("login() persists the token and resolves the user (same tab, no reload)", async () => {
    mockGetCurrentUser.mockResolvedValue({ data: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    const token = futureJwt();
    act(() => result.current.login(token));

    await waitFor(() => expect(result.current.user).toEqual(mockUser));
    expect(localStorage.getItem("token")).toBe(token);
  });

  it("logout() clears the token, the legacy user blob, and the user", async () => {
    localStorage.setItem("token", futureJwt());
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
    localStorage.setItem("token", futureJwt());
    mockGetCurrentUser.mockResolvedValue({ message: "ok" });

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("clears the session when /me rejects with a 403 (revoked/rotated token)", async () => {
    localStorage.setItem("token", futureJwt());
    localStorage.setItem("user", '{"id":"u1"}');
    mockGetCurrentUser.mockRejectedValue(
      new ApiError("Invalid or expired token", 403),
    );

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.token).toBeNull());
    expect(result.current.user).toBeNull();
    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  it("keeps the token and sets an error when /me fails with a network/5xx blip", async () => {
    const token = futureJwt();
    localStorage.setItem("token", token);
    mockGetCurrentUser.mockRejectedValue(new ApiError("Server error", 500));

    const { result } = renderHook(() => useAuth(), { wrapper });

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.user).toBeNull();
    // A transient outage must not log the user out.
    expect(result.current.token).toBe(token);
  });

  it("syncs cross-tab: a storage event re-resolves identity from the new token", async () => {
    mockGetCurrentUser.mockResolvedValue({ data: mockUser });

    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();

    const token = futureJwt();
    act(() => {
      localStorage.setItem("token", token);
      window.dispatchEvent(
        new StorageEvent("storage", { key: "token", newValue: token }),
      );
    });

    await waitFor(() => expect(result.current.user).toEqual(mockUser));
    expect(result.current.token).toBe(token);
  });

  it("syncs cross-tab logout: a full-store clear drops the user", async () => {
    localStorage.setItem("token", futureJwt());
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
