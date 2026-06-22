import { renderHook, waitFor, act } from "@testing-library/react";
import { useUser, emitAuthChange } from "../hooks/useUser";
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
  role: null,
  lbusername: "someuser",
  displayName: "Some User",
};

const mockGetCurrentUser = vi.mocked(apiService.getCurrentUser);

describe("useUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installFakeLocalStorage();
  });

  it("returns a null user and stops loading when no token is present", async () => {
    const { result } = renderHook(() => useUser());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(mockGetCurrentUser).not.toHaveBeenCalled();
  });

  it("fetches and returns the current user when a token is present", async () => {
    localStorage.setItem("token", "valid-token");
    mockGetCurrentUser.mockResolvedValue({ data: mockUser });

    const { result } = renderHook(() => useUser());

    await waitFor(() => expect(result.current.user).toEqual(mockUser));
    expect(mockGetCurrentUser).toHaveBeenCalledWith(
      "valid-token",
      expect.any(AbortSignal),
    );
    expect(result.current.loading).toBe(false);
  });

  it("treats a 2xx response without a user as no user", async () => {
    localStorage.setItem("token", "valid-token");
    mockGetCurrentUser.mockResolvedValue({ message: "ok" });

    const { result } = renderHook(() => useUser());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
  });

  it("sets an error and null user when the request fails", async () => {
    localStorage.setItem("token", "bad-token");
    mockGetCurrentUser.mockRejectedValue(new Error("Invalid or expired token"));

    const { result } = renderHook(() => useUser());

    await waitFor(() => expect(result.current.error).not.toBeNull());
    expect(result.current.user).toBeNull();
  });

  it("re-syncs to null on logout (token cleared + authchange)", async () => {
    localStorage.setItem("token", "valid-token");
    mockGetCurrentUser.mockResolvedValue({ data: mockUser });

    const { result } = renderHook(() => useUser());
    await waitFor(() => expect(result.current.user).toEqual(mockUser));

    act(() => {
      localStorage.removeItem("token");
      emitAuthChange();
    });

    await waitFor(() => expect(result.current.user).toBeNull());
  });

  it("re-syncs to the new user on login (token set + authchange)", async () => {
    const { result } = renderHook(() => useUser());
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();

    mockGetCurrentUser.mockResolvedValue({ data: mockUser });
    act(() => {
      localStorage.setItem("token", "valid-token");
      emitAuthChange();
    });

    await waitFor(() => expect(result.current.user).toEqual(mockUser));
  });
});
