-- Multiple rosters per user. MFLRosters is the new parent: one row per named
-- roster. MFLUserPicks becomes its child, keyed on roster_id instead of
-- lbusername, so a user can keep several independent rosters and the same film
-- can appear in more than one of them.

CREATE TABLE IF NOT EXISTS "public"."MFLRosters" (
    "roster_id" bigint GENERATED ALWAYS AS IDENTITY,
    "lbusername" character varying NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mfl_rosters_pkey" PRIMARY KEY ("roster_id"),
    CONSTRAINT "mfl_rosters_lbusername_fkey"
        FOREIGN KEY ("lbusername") REFERENCES "public"."Users"("lbusername") ON DELETE CASCADE,
    CONSTRAINT "mfl_rosters_name_length"
        CHECK ("char_length"("btrim"("name")) BETWEEN 1 AND 80),
    CONSTRAINT "mfl_rosters_user_name_key" UNIQUE ("lbusername", "name")
);

ALTER TABLE "public"."MFLRosters" OWNER TO "postgres";

COMMENT ON TABLE "public"."MFLRosters" IS 'Named rosters. One row per roster; a user may own several. Picks hang off roster_id.';

-- One roster per existing member, holding their current picks. Named 'My Picks'
-- so the pre-multi-roster data reads sensibly in the new dropdown.
INSERT INTO "public"."MFLRosters" ("lbusername", "name")
SELECT DISTINCT "lbusername", 'My Picks'
FROM "public"."MFLUserPicks";

-- Repoint picks at their roster while lbusername is still present, then retire it.
ALTER TABLE "public"."MFLUserPicks" ADD COLUMN "roster_id" bigint;

UPDATE "public"."MFLUserPicks" AS "p"
SET "roster_id" = "r"."roster_id"
FROM "public"."MFLRosters" AS "r"
WHERE "r"."lbusername" = "p"."lbusername";

ALTER TABLE "public"."MFLUserPicks"
    DROP CONSTRAINT "mfl_user_picks_pkey",
    DROP CONSTRAINT "mfl_user_picks_lbusername_fkey";

ALTER TABLE "public"."MFLUserPicks" DROP COLUMN "lbusername";

ALTER TABLE "public"."MFLUserPicks" ALTER COLUMN "roster_id" SET NOT NULL;

ALTER TABLE "public"."MFLUserPicks"
    ADD CONSTRAINT "mfl_user_picks_pkey" PRIMARY KEY ("roster_id", "film_slug"),
    ADD CONSTRAINT "mfl_user_picks_roster_id_fkey"
        FOREIGN KEY ("roster_id") REFERENCES "public"."MFLRosters"("roster_id") ON DELETE CASCADE;

-- CASCADE on roster_id: a pick is meaningless without its roster, and deleting a
-- user still reaches picks through Users → MFLRosters → MFLUserPicks. film_slug
-- keeps its RESTRICT FK from the original table so removing a rostered film still
-- fails loudly. idx_mfl_user_picks_film_slug (film_slug) is untouched.

-- RLS on with no policies, matching every other MFL table. The server reaches
-- these through the direct Postgres connection, which is not subject to RLS.
ALTER TABLE "public"."MFLRosters" ENABLE ROW LEVEL SECURITY;
