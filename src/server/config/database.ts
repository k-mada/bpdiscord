import { createClient, SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

// Load environment variables immediately
dotenv.config();

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
