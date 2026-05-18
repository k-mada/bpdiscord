-- app_users links Supabase Auth accounts (auth.users) to Letterboxd usernames
-- (public."Users".lbusername). One row per auth user; lbusername is nullable and
-- unique so most rows can have NULL until linked, and at most one account can
-- claim a given lbusername.
--
-- Lenient signup model (per bpdiscord-cqg): any well-formed lbusername is
-- accepted at signup. If the lbusername has no matching "Users" row yet, the
-- signup controller upserts a stub row and enqueues a user_scrape_jobs entry
-- so data populates async. Admins fix bad linkings via /admin/users.

CREATE TABLE IF NOT EXISTS "public"."app_users" (
    "id" "uuid" NOT NULL,
    "lbusername" character varying,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "app_users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "app_users_id_auth_users_fkey"
        FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE,
    CONSTRAINT "app_users_lbusername_users_fkey"
        FOREIGN KEY ("lbusername") REFERENCES "public"."Users"("lbusername") ON DELETE SET NULL,
    CONSTRAINT "app_users_lbusername_key" UNIQUE ("lbusername")
);

ALTER TABLE "public"."app_users" OWNER TO "postgres";

-- Backfill: one row per existing auth.users so the admin list endpoint can
-- SELECT * FROM app_users without UNIONing against auth.users to find unlinked
-- accounts. Idempotent — re-running the migration is a no-op.
INSERT INTO "public"."app_users" ("id")
SELECT "id" FROM "auth"."users"
ON CONFLICT DO NOTHING;

-- RLS: backend writes go through the service role (which bypasses). The
-- select-own policy lets an authenticated client read its own row (e.g. "what
-- Letterboxd username am I linked to?") without the server brokering it.
ALTER TABLE "public"."app_users" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "app_users_select_own"
    ON "public"."app_users"
    FOR SELECT
    USING ("auth"."uid"() = "id");
