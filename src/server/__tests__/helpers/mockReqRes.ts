import type { Request, Response } from "express";

export interface MockedReqRes {
  req: Request;
  res: Response;
  /** Status codes in call order. Empty means the handler never set one. */
  statusCalls: number[];
  /** Payloads passed to res.json, in call order. */
  jsonCalls: unknown[];
  /** Headers set via res.set. */
  headers: Record<string, string>;
}

export interface MockReqResArgs {
  body?: Record<string, unknown>;
  params?: Record<string, string>;
  query?: Record<string, string>;
  /** Populated as the authenticateToken middleware would. */
  user?: { id: string; email?: string; user_metadata?: Record<string, unknown> };
}

/**
 * Minimal Express req/res double for controller tests.
 *
 * Records status codes, JSON payloads and headers rather than asserting on
 * them, so the assertions stay in the `it()` blocks that triggered them.
 */
export function mockReqRes(args: MockReqResArgs = {}): MockedReqRes {
  const statusCalls: number[] = [];
  const jsonCalls: unknown[] = [];
  const headers: Record<string, string> = {};

  const res = {} as {
    status: (code: number) => unknown;
    json: (payload: unknown) => unknown;
    set: (key: string, value: string) => unknown;
  };
  res.status = (code: number) => {
    statusCalls.push(code);
    return res;
  };
  res.json = (payload: unknown) => {
    jsonCalls.push(payload);
    return res;
  };
  res.set = (key: string, value: string) => {
    headers[key] = value;
    return res;
  };

  const req = {
    body: args.body ?? {},
    params: args.params ?? {},
    query: args.query ?? {},
    user: args.user,
  } as unknown as Request;

  return { req, res: res as unknown as Response, statusCalls, jsonCalls, headers };
}
