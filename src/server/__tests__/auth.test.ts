/**
 * Unit tests for the auth middleware — the real server-side authorization
 * gate. The route-wiring tests prove each middleware is *attached* to the
 * right routes; these prove it actually accepts and rejects the right
 * requests. Supabase is mocked so no network or DB is involved.
 *
 * Run with: yarn test
 */

import { vi, describe, it, expect, beforeEach } from "vitest";
import { mockReqRes } from "./helpers/mockReqRes";

const getUser = vi.fn();

vi.mock("../config/database", async () => {
  const actual = await vi.importActual<typeof import("../config/database")>(
    "../config/database",
  );
  return {
    ...actual,
    createSupabaseClient: vi.fn(() => ({ auth: { getUser } })),
  };
});

import {
  authenticateToken,
  authorizeAdmin,
  authorizeEditor,
  authorizeOwnerOrAdmin,
} from "../middleware/auth";
import { createSupabaseClient } from "../config/database";

const user = { id: "user-1", app_metadata: { role: "member" } };

describe("authenticateToken", () => {
  beforeEach(() => {
    vi.mocked(createSupabaseClient).mockClear();
    getUser.mockReset();
  });

  it("401s when no token is present", async () => {
    const { req, res, statusCalls, jsonCalls } = mockReqRes();
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(statusCalls).toEqual([401]);
    expect(jsonCalls[0]).toMatchObject({ error: "Access token required" });
    expect(next).not.toHaveBeenCalled();
    expect(getUser).not.toHaveBeenCalled();
  });

  it("accepts a valid bearer token, populates req.user, and calls next", async () => {
    getUser.mockResolvedValue({ data: { user }, error: null });
    const { req, res, statusCalls } = mockReqRes({
      headers: { authorization: "Bearer good-token" },
    });
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(getUser).toHaveBeenCalledWith("good-token");
    expect(req.user).toEqual(user);
    // The per-request client must be scoped to the caller's token so RLS
    // runs as that user, not anonymously.
    expect(req.supabase).toBeDefined();
    expect(createSupabaseClient).toHaveBeenCalledWith("good-token");
    expect(next).toHaveBeenCalledTimes(1);
    expect(statusCalls).toEqual([]);
  });

  it("falls back to the x_authorization header when authorization is absent", async () => {
    getUser.mockResolvedValue({ data: { user }, error: null });
    const { req, res } = mockReqRes({
      headers: { x_authorization: "Bearer fallback-token" },
    });
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(getUser).toHaveBeenCalledWith("fallback-token");
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("403s when Supabase returns an error", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: { message: "bad" } });
    const { req, res, statusCalls, jsonCalls } = mockReqRes({
      headers: { authorization: "Bearer expired" },
    });
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(statusCalls).toEqual([403]);
    expect(jsonCalls[0]).toMatchObject({ error: "Invalid or expired token" });
    expect(next).not.toHaveBeenCalled();
  });

  it("403s when Supabase returns no user and no error", async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });
    const { req, res, statusCalls } = mockReqRes({
      headers: { authorization: "Bearer ghost" },
    });
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(statusCalls).toEqual([403]);
    expect(next).not.toHaveBeenCalled();
  });

  it("403s when the token check throws", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    getUser.mockRejectedValue(new Error("network down"));
    const { req, res, statusCalls, jsonCalls } = mockReqRes({
      headers: { authorization: "Bearer boom" },
    });
    const next = vi.fn();

    await authenticateToken(req, res, next);

    expect(statusCalls).toEqual([403]);
    expect(jsonCalls[0]).toMatchObject({ error: "Token verification failed" });
    expect(next).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});

describe("authorizeAdmin", () => {
  it("calls next for an admin", () => {
    const { req, res, statusCalls } = mockReqRes({
      user: { id: "a", app_metadata: { role: "admin" } },
    });
    const next = vi.fn();

    authorizeAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(statusCalls).toEqual([]);
  });

  it("ignores user_metadata.role entirely — only app_metadata grants admin", () => {
    const { req, res, statusCalls, jsonCalls } = mockReqRes({
      user: {
        id: "a",
        // The self-writable field claims admin; it must not be honored.
        user_metadata: { role: "admin" },
      },
    });
    const next = vi.fn();

    authorizeAdmin(req, res, next);

    expect(statusCalls).toEqual([403]);
    expect(jsonCalls[0]).toMatchObject({ error: "Admin access required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("403s a non-admin", () => {
    const { req, res, statusCalls, jsonCalls } = mockReqRes({ user });
    const next = vi.fn();

    authorizeAdmin(req, res, next);

    expect(statusCalls).toEqual([403]);
    expect(jsonCalls[0]).toMatchObject({ error: "Admin access required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("403s when there is no authenticated user", () => {
    const { req, res, statusCalls } = mockReqRes();
    const next = vi.fn();

    authorizeAdmin(req, res, next);

    expect(statusCalls).toEqual([403]);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("authorizeEditor", () => {
  it.each([["editor"], ["admin"]])("calls next for an %s", (role) => {
    const { req, res, statusCalls } = mockReqRes({
      user: { id: "a", app_metadata: { role } },
    });
    const next = vi.fn();

    authorizeEditor(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(statusCalls).toEqual([]);
  });

  it("403s a member", () => {
    const { req, res, statusCalls, jsonCalls } = mockReqRes({ user });
    const next = vi.fn();

    authorizeEditor(req, res, next);

    expect(statusCalls).toEqual([403]);
    expect(jsonCalls[0]).toMatchObject({ error: "Editor access required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("403s when there is no authenticated user", () => {
    const { req, res, statusCalls } = mockReqRes();
    const next = vi.fn();

    authorizeEditor(req, res, next);

    expect(statusCalls).toEqual([403]);
    expect(next).not.toHaveBeenCalled();
  });

  it("ignores a self-set user_metadata.role", () => {
    const { req, res, statusCalls } = mockReqRes({
      user: { id: "a", user_metadata: { role: "editor" } },
    });
    const next = vi.fn();

    authorizeEditor(req, res, next);

    expect(statusCalls).toEqual([403]);
    expect(next).not.toHaveBeenCalled();
  });
});

describe("authorizeOwnerOrAdmin", () => {
  it("401s when there is no authenticated user", () => {
    const { req, res, statusCalls, jsonCalls } = mockReqRes({
      params: { id: "user-1" },
    });
    const next = vi.fn();

    authorizeOwnerOrAdmin(req, res, next);

    expect(statusCalls).toEqual([401]);
    expect(jsonCalls[0]).toMatchObject({ error: "Authentication required" });
    expect(next).not.toHaveBeenCalled();
  });

  it("calls next when the caller owns the resource", () => {
    const { req, res, statusCalls } = mockReqRes({
      params: { id: "user-1" },
      user,
    });
    const next = vi.fn();

    authorizeOwnerOrAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(statusCalls).toEqual([]);
  });

  it("calls next when a non-owner is an admin", () => {
    const { req, res, statusCalls } = mockReqRes({
      params: { id: "someone-else" },
      user: { id: "admin-1", app_metadata: { role: "admin" } },
    });
    const next = vi.fn();

    authorizeOwnerOrAdmin(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(statusCalls).toEqual([]);
  });

  it("403s a non-owner who is not an admin", () => {
    const { req, res, statusCalls, jsonCalls } = mockReqRes({
      params: { id: "someone-else" },
      user,
    });
    const next = vi.fn();

    authorizeOwnerOrAdmin(req, res, next);

    expect(statusCalls).toEqual([403]);
    expect(jsonCalls[0]).toMatchObject({
      error: "Access denied. You can only access your own data.",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
