import { isJwtExpired } from "../lib/jwt";
import { makeJwt } from "./helpers/jwt";

// Build a JWT carrying an arbitrary payload (helpers/jwt only sets exp).
function jwtWithPayload(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.sig`;
}

const now = () => Math.floor(Date.now() / 1000);

describe("isJwtExpired", () => {
  it("returns false for a token whose exp is comfortably in the future", () => {
    expect(isJwtExpired(makeJwt(now() + 3600))).toBe(false);
  });

  it("returns true for a token whose exp is in the past", () => {
    expect(isJwtExpired(makeJwt(now() - 3600))).toBe(true);
  });

  it("treats a token inside the clock-skew buffer as expired", () => {
    // exp 10s out, default skew 30s → considered expired.
    expect(isJwtExpired(makeJwt(now() + 10))).toBe(true);
  });

  it("treats a token with no exp claim as expired", () => {
    expect(isJwtExpired(jwtWithPayload({ sub: "user" }))).toBe(true);
  });

  it("treats a malformed (non-JWT) string as expired", () => {
    expect(isJwtExpired("not-a-jwt")).toBe(true);
    expect(isJwtExpired("a.b")).toBe(true);
    expect(isJwtExpired("a.!!!.c")).toBe(true);
  });
});
