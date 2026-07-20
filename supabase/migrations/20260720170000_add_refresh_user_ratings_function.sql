-- refresh_user_ratings: recompute one user's rating histogram from UserFilms.
--
-- Why: UserRatings is a per-(username, rating) count that must mirror the
-- user's full UserFilms distribution. moviemaestro's grid scraper can count
-- in-memory because it holds the entire diary, but the RSS /refresh-user path
-- only sees ~50 recent items — counting those would clobber the true totals.
-- Both paths instead call this function so the histogram is always derived
-- from the persisted rows, in one place.
--
-- Full replace (delete + re-aggregate) inside a single function is atomic:
-- external readers see either the old histogram or the new one, never an
-- empty intermediate. It also clears rating levels a user has since abandoned,
-- which the old upsert-only-present-levels approach left stale.

CREATE OR REPLACE FUNCTION "public"."refresh_user_ratings"("p_username" "text")
RETURNS void
    LANGUAGE "sql"
    AS $$
    DELETE FROM "UserRatings" WHERE username = p_username;

    INSERT INTO "UserRatings" (username, rating, count, updated_at)
    SELECT lbusername, rating, count(*)::integer, now()
    FROM "UserFilms"
    WHERE lbusername = p_username AND rating IS NOT NULL
    GROUP BY lbusername, rating;
$$;

ALTER FUNCTION "public"."refresh_user_ratings"("text") OWNER TO "postgres";
