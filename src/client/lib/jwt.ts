interface JwtPayload {
  exp?: number;
}

// Decode a JWT payload without verifying the signature — the server is the only
// authority on validity; the client reads `exp` purely to avoid a doomed
// round-trip with an already-dead token. Returns null on any malformed input.
function decodePayload(token: string): JwtPayload | null {
  const parts = token.split(".");
  const encodedPayload = parts[1];
  if (parts.length !== 3 || !encodedPayload) return null;
  try {
    const b64 = encodedPayload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join(""),
    );
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

/**
 * True when the token is past its `exp` (minus a clock-skew buffer), or is
 * malformed / has no `exp`. Undecodable tokens are treated as expired so a
 * corrupted localStorage value is cleared rather than sent to the server.
 */
export function isJwtExpired(token: string, skewSeconds = 30): boolean {
  const payload = decodePayload(token);
  if (!payload?.exp) return true;
  return Date.now() >= (payload.exp - skewSeconds) * 1000;
}
