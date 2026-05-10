-- refresh_jobs tracks the Hater Rankings refresh pipeline orchestrated by the
-- moviemaestro worker. One row per pipeline run. The bpdiscord admin endpoint
-- inserts a row and POSTs to the worker's /start; the worker updates progress
-- and polls status='cancelled' between films for clean cancellation.

CREATE TABLE IF NOT EXISTS "public"."refresh_jobs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "status" "text" NOT NULL,
    "started_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "finished_at" timestamp with time zone,
    "started_by" "uuid" NOT NULL,
    "phase" "text",
    "progress" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "errors" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "log_tail" "text" DEFAULT ''::"text" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "refresh_jobs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "refresh_jobs_status_check"
        CHECK ("status" IN ('pending', 'running', 'completed', 'failed', 'cancelled'))
);

ALTER TABLE "public"."refresh_jobs" OWNER TO "postgres";

-- Single-flight: at most one row may be 'running' at a time. The partial
-- unique index makes a parallel INSERT fail with a unique violation, which
-- the bpdiscord admin endpoint catches and surfaces as 409 with the existing
-- job id. Defense in depth alongside the worker's own status check.
CREATE UNIQUE INDEX IF NOT EXISTS "refresh_jobs_one_running"
    ON "public"."refresh_jobs" ("status")
    WHERE "status" = 'running';

-- Realtime: the bpdiscord admin UI subscribes to postgres_changes on this
-- table for live progress updates without polling.
ALTER PUBLICATION "supabase_realtime" ADD TABLE "public"."refresh_jobs";

-- RLS: the client-side Realtime subscription uses the anon key + user JWT,
-- so RLS applies there. The worker (service role) and bpdiscord backend
-- (DATABASE_URL postgres role) both bypass RLS. Admins see only their own
-- jobs from the browser.
ALTER TABLE "public"."refresh_jobs" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "refresh_jobs_select_own"
    ON "public"."refresh_jobs"
    FOR SELECT
    USING ("auth"."uid"() = "started_by");
