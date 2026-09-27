const GMAIL_DOMAINS = new Set(["gmail.com", "googlemail.com"]);

/**
 * Canonicalize an email to the form Supabase Auth stores.
 *
 * Supabase normalizes Gmail addresses (dots and +tags are insignificant to
 * Gmail) on signup and login, but NOT on resetPasswordForEmail, whose lookup is
 * exact-match. Applying the same normalization before a reset call keeps the
 * three flows consistent so a dotted/+tag variant still finds the account.
 *
 * @param raw email as the user typed it
 * @returns lowercased, trimmed; for Gmail also with dots and any +tag removed
 */
export function canonicalizeEmail(raw: string): string {
  const trimmed = raw.trim().toLowerCase();
  const at = trimmed.lastIndexOf("@");
  if (at === -1) return trimmed;

  let local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);

  if (GMAIL_DOMAINS.has(domain)) {
    const plus = local.indexOf("+");
    if (plus !== -1) local = local.slice(0, plus);
    local = local.replace(/\./g, "");
  }

  return `${local}@${domain}`;
}
