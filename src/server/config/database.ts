import { createClient, SupabaseClient } from "@supabase/supabase-js";

import { User } from "../types";
import dotenv from "dotenv";

// Load environment variables immediately
dotenv.config();

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
  throw new Error("Missing required Supabase environment variables");
}

export const supabaseUrl: string = process.env.SUPABASE_URL;
export const supabaseAnonKey: string = process.env.SUPABASE_ANON_KEY;
export const supabaseServiceKey: string =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

export const createSupabaseClient = (token?: string): SupabaseClient => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: token ? { headers: { Authorization: `Bearer ${token}` } } : {},
  });
};

// Client for user-facing operations (with RLS)
export const supabase = createSupabaseClient();

// Admin client for server-side operations (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// Database type definitions
export interface Database {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Omit<User, "created_at" | "updated_at">;
        Update: Partial<Omit<User, "id" | "created_at" | "updated_at">>;
      };
    };
  };
}
