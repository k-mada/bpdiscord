/**
 * Unit tests for callWorkerJson — the JSON-returning worker POST used by the
 * synchronous /refresh-user proxy. fetch is stubbed; no DB or network.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

import { callWorkerJson } from "../controllers/jobHelpers";

const config = { url: "http://worker.test", sharedSecret: "secret" };

afterEach(() => {
  vi.restoreAllMocks();
});

describe("callWorkerJson", () => {
  it("returns the parsed body and sends the bearer token + JSON payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ lbusername: "alice", watch_items: 3, upserted: 3 }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await callWorkerJson(config, "/refresh-user", {
      lbusername: "alice",
    });
    expect(result).toEqual({ lbusername: "alice", watch_items: 3, upserted: 3 });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://worker.test/refresh-user");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer secret");
    expect(JSON.parse(init.body)).toEqual({ lbusername: "alice" });
  });

  it("throws on non-2xx, surfacing the status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("private user", { status: 502 })),
    );
    await expect(
      callWorkerJson(config, "/refresh-user", { lbusername: "ghost" }),
    ).rejects.toThrow(/502/);
  });

  it("aborts and rejects when the worker exceeds the timeout", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(
        (_url, init: { signal: AbortSignal }) =>
          new Promise((_resolve, reject) => {
            init.signal.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      ),
    );
    await expect(
      callWorkerJson(config, "/refresh-user", {}, 10),
    ).rejects.toThrow();
  });
});
