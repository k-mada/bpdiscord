-- One official roster per user. The official roster is the one ranked on the
-- main "Standings" list; every roster still ranks on "Sicko Mode".

ALTER TABLE "public"."MFLRosters"
    ADD COLUMN "is_official" boolean NOT NULL DEFAULT false;

-- Backfill: each user's oldest roster becomes official, so the standings that
-- ranked every roster before this change keep showing the same people.
UPDATE "public"."MFLRosters" AS "r"
SET "is_official" = true
FROM (
    SELECT DISTINCT ON ("lbusername") "roster_id"
    FROM "public"."MFLRosters"
    ORDER BY "lbusername", "created_at", "roster_id"
) AS "oldest"
WHERE "r"."roster_id" = "oldest"."roster_id";

-- At most one official roster per user, enforced in the database so the
-- clear-then-set switch in dbUpdateRoster cannot leave two.
CREATE UNIQUE INDEX "mfl_rosters_one_official_per_user"
    ON "public"."MFLRosters" ("lbusername")
    WHERE "is_official";
