import "../loadEnv";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error("Missing required Supabase environment variables");
}

const supabaseUrl: string = process.env.SUPABASE_URL;
const supabaseAnonKey: string = process.env.SUPABASE_ANON_KEY;

/**
 * Creates a Supabase client for authentication operations.
 * Data operations now use Drizzle ORM (see db/index.ts).
 */
export const createSupabaseClient = (token?: string): SupabaseClient => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  });
};

// Bypasses RLS and grants `auth.admin.*`. The key is read at call time so
// paths that never need admin don't crash when the env var is absent.
export const createSupabaseAdminClient = (): SupabaseClient => {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY — required for admin operations.",
    );
  }
  return createClient(supabaseUrl, serviceRoleKey);
};
