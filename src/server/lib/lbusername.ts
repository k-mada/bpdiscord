// Shared validation + normalization for Letterboxd.com usernames. Used at the
// signup boundary (authController) and the admin link/edit boundary
// (userAdminController). Keeping these in one place so the two surfaces can't
// drift on what counts as a valid lbusername.

// Letterboxd's actual rules: 2-15 chars, lowercase alphanumeric + hyphen +
// underscore. The regex assumes input is already lowercased; pair with
// normalizeLbusername below.
export const LBUSERNAME_FORMAT = /^[a-z0-9_-]{2,15}$/;

export function normalizeLbusername(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
}
