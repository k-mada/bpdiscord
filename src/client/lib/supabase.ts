import { createClient } from "@supabase/supabase-js";

// Password reset is the one auth flow that can't go through /api/auth/* — the
// recovery code lands in the browser URL hash, not on the server.

const url = import.meta.env["VITE_SUPABASE_URL"];
const anonKey = import.meta.env["VITE_SUPABASE_ANON_KEY"];

if (!url || !anonKey) {
  throw new Error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Add them to src/client/.env (mirror the server-side SUPABASE_* values).",
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    // In-memory only: clicking a recovery email link must not by itself grant
    // a persisted session. Real auth is the 'token' key set by /login.
    persistSession: false,
    autoRefreshToken: false,
  },
});
