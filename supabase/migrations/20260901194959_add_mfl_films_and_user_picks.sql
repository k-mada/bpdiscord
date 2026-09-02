-- MFLFilms is the season's film catalogue: every film available to pick, whether
-- or not anyone rostered it. MFLUserPicks is the roster edge. Both are additive
-- here — MFLMovieData and MFLUserMovies stay in place until bpdiscord-nzu drops
-- them, so nothing that currently reads them breaks when this lands.

CREATE TABLE IF NOT EXISTS "public"."MFLFilms" (
    "film_slug" "text" NOT NULL,
    "title" "text" NOT NULL,
    "release_date" "date",
    "price" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "mfl_films_pkey" PRIMARY KEY ("film_slug")
);

ALTER TABLE "public"."MFLFilms" OWNER TO "postgres";

COMMENT ON TABLE "public"."MFLFilms" IS 'Films available to pick this season. Deliberately no FK to "Films": an MFL film may not be scraped yet, and "Films" carries release_year rather than a full date.';

CREATE TABLE IF NOT EXISTS "public"."MFLUserPicks" (
    "lbusername" character varying NOT NULL,
    "film_slug" "text" NOT NULL,
    CONSTRAINT "mfl_user_picks_pkey" PRIMARY KEY ("lbusername", "film_slug"),
    CONSTRAINT "mfl_user_picks_lbusername_fkey"
        FOREIGN KEY ("lbusername") REFERENCES "public"."Users"("lbusername") ON DELETE CASCADE,
    CONSTRAINT "mfl_user_picks_film_slug_fkey"
        FOREIGN KEY ("film_slug") REFERENCES "public"."MFLFilms"("film_slug") ON DELETE RESTRICT
);

ALTER TABLE "public"."MFLUserPicks" OWNER TO "postgres";

-- CASCADE on lbusername: the pick is meaningless without the user, and
-- lbusername is half the primary key so SET NULL is not available.
-- RESTRICT on film_slug: removing a film someone rostered must fail loudly.
-- CASCADE there would silently delete every user's pick when an admin corrects
-- a mistyped slug through the /mfl/admin/films table.

-- The primary key indexes (lbusername, film_slug), which cannot serve a lookup
-- keyed on film_slug alone. "Which users picked this film" needs the reverse
-- direction, and the RESTRICT check above scans the same way on every delete.
CREATE INDEX "idx_mfl_user_picks_film_slug"
    ON "public"."MFLUserPicks" USING "btree" ("film_slug");

-- Production carries 12 exact-duplicate award pairs — identical film, metric and
-- points_awarded — which double-count into film totals (one-battle-after-another
-- reads 1526 against a true 1411). Collapse to the lowest scoring_id before the
-- constraint that makes the state unreachable.
DELETE FROM "public"."MFLScoringTally" AS "a"
USING "public"."MFLScoringTally" AS "b"
WHERE "a"."film_slug" = "b"."film_slug"
  AND "a"."metric_id" = "b"."metric_id"
  AND "a"."scoring_id" > "b"."scoring_id";

-- Verified zero NULLs before tightening. Without NOT NULL the unique constraint
-- below is porous: Postgres treats NULLs as distinct, so (NULL, 5) could repeat
-- and bpdiscord-6c7's 409 would not fire.
ALTER TABLE "public"."MFLScoringTally"
    ALTER COLUMN "film_slug" SET NOT NULL,
    ALTER COLUMN "metric_id" SET NOT NULL;

-- A named constraint rather than a bare unique index: bpdiscord-6c7 maps this
-- name to a 409, and the name is what Postgres reports in the error.
ALTER TABLE "public"."MFLScoringTally"
    ADD CONSTRAINT "mfl_scoring_tally_film_metric_key" UNIQUE ("film_slug", "metric_id");

-- RLS on with no policies, matching every existing MFL table. The server reaches
-- these through the direct Postgres connection, which is not subject to RLS;
-- anon and authenticated get nothing until a policy deliberately grants it.
ALTER TABLE "public"."MFLFilms" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."MFLUserPicks" ENABLE ROW LEVEL SECURITY;
