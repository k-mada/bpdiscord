import { createClient } from "@supabase/supabase-js";

// Singleton Supabase JS client for direct browser flows (e.g. password
// reset). Most auth flows in this app go through our /api/auth/* endpoints;
// reset is the exception because Supabase's recovery email link points at
// the client URL — the recovery code arrives in the browser, not the server.
//
// persistSession: false — we manage our own auth via the 'token' localStorage
// key set by /login. The recovery session lives in memory long enough to call
// updateUser, then we sign out.
//
// detectSessionInUrl: true (default in browser) — on page load, the SDK auto-
// extracts the recovery code from the URL hash and establishes a session.

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
    persistSession: false,
    autoRefreshToken: false,
  },
});
