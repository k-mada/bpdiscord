-- user_scrape_jobs tracks per-user film-refresh jobs triggered from /fetcher.
-- Same lifecycle as refresh_jobs (bulk Hater Rankings refresh), but scoped to
-- one Letterboxd user and allowing concurrent runs for *different* users.
-- moviemaestro's orchestrator drives both paths from one parameterized
-- run(table=..., lbusername=...) entry point — see bpdiscord-aiy step 1b.

CREATE TABLE IF NOT EXISTS "public"."user_scrape_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lbusername" character varying NOT NULL,
    "status" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "started_by" "uuid" NOT NULL,
    "phase" "text",
    "progress" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "errors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "log_tail" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_scrape_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "user_scrape_jobs_status_check"
        CHECK ("status" IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

ALTER TABLE "public"."user_scrape_jobs" OWNER TO "postgres";

-- Single-flight per username: at most one row per (lbusername) may be
-- 'running' at a time. Two users can scrape in parallel; the same user can't.
-- Parallel inserts for the same user fail with a unique violation (23505) on
-- this constraint; the bpdiscord trigger handler catches that and returns 409
-- with the existing job id so the UI can resume polling it.
CREATE UNIQUE INDEX IF NOT EXISTS "user_scrape_jobs_one_running_per_user"
    ON "public"."user_scrape_jobs" ("lbusername")
    WHERE "status" = 'running';

-- For Realtime parity with refresh_jobs. The /fetcher UI subscribes here.
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."user_scrape_jobs";

-- RLS: same model as refresh_jobs. Service role / DATABASE_URL bypass; users
-- see only their own jobs via Realtime + Supabase JS clients.
ALTER TABLE "public"."user_scrape_jobs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user_scrape_jobs_select_own"
    ON "public"."user_scrape_jobs"
    FOR SELECT
    USING ("auth"."uid"() = "started_by");


-- Scoped variant of get_missing_films(): returns the slugs in ONE user's
-- UserFilms rows that aren't yet in Films. Used by moviemaestro's phase 2
-- when lbusername is set. The leading column of UserFilms's composite PK
-- (lbusername, film_slug) and the NOT EXISTS lookup on Films's PK make this
-- a single small index scan + N PK lookups, where N = user's film count.

CREATE OR REPLACE FUNCTION "public"."get_missing_films_for_user"("p_lbusername" "text")
RETURNS "text"[]
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    result text[];
BEGIN
    SELECT array_agg(DISTINCT uf.film_slug)
    INTO result
    FROM "UserFilms" uf
    WHERE uf.lbusername = p_lbusername
      AND NOT EXISTS (
          SELECT 1 FROM "Films" f WHERE f.film_slug = uf.film_slug
      );
    RETURN COALESCE(result, ARRAY[]::text[]);
END;
$$;

ALTER FUNCTION "public"."get_missing_films_for_user"("p_lbusername" "text")
    OWNER TO "postgres";
