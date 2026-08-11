// Mirrors Letterboxd's own rules (2-15 chars). Assumes already-lowercased
// input — pair with normalizeLbusername below.
export const LBUSERNAME_FORMAT = /^[a-z0-9_-]{2,15}$/;

export function normalizeLbusername(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
}
