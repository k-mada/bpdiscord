-- Write a scraped film and fold its duplicates into it, in one transaction.
--
-- When Letterboxd re-slugs a film the worker orphans the old slug and scrapes a
-- new Films row sharing the same tmdb_link, so slug-keyed features double-count.
-- The one-time backfill 20261017143344_dedupe_films_by_tmdb.sql drained the
-- existing groups; this function stops the worker minting new ones at the source.
--
-- The worker calls this in place of upsert_film. Write and merge share one
-- transaction: a merge failure rolls the upsert back, so the slug stays in
-- missing_films and the next run retries — a committed Films row would otherwise
-- never be re-scraped, stranding the duplicate forever (there is no sweep).
--
-- Canonical = the just-scraped live slug (letterboxdpy follows Letterboxd's
-- redirect), a stronger signal than the backfill's created_at heuristic.
--
-- Index: the merge filters Films on tmdb_link once per scraped film; without it
-- that is a ~23k-row seq scan per call.

CREATE INDEX IF NOT EXISTS "idx_films_tmdb_link" ON "Films" ("tmdb_link");

CREATE OR REPLACE FUNCTION "public"."upsert_film_and_merge_duplicates"(
    "p_film_slug"    "text",
    "p_title"        "text",
    "p_lb_rating"    real,
    "p_url"          "text",
    "p_tmdb_link"    "text",
    "p_poster"       "text",
    "p_banner"       "text",
    "p_release_year" integer
)
RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    v_tmdb   text;
    v_users  text[];
    v_merged integer;
BEGIN
    PERFORM "upsert_film"(
        p_film_slug, p_title, p_lb_rating, p_url, p_tmdb_link,
        p_poster, p_banner, p_release_year
    );

    -- Read the STORED key, not p_tmdb_link: upsert_film COALESCEs, so a NULL arg
    -- keeps the row's existing tmdb_link and the merge must key on that.
    SELECT tmdb_link INTO v_tmdb FROM "Films" WHERE film_slug = p_film_slug;

    -- Only a real, non-zero TMDB id is an identity; /tv/0 etc. group unrelated
    -- films — never merge on them.
    IF v_tmdb IS NULL OR v_tmdb !~ '/(movie|tv)/[1-9][0-9]*/?$' THEN
        RETURN 0;
    END IF;

    -- Hot-path short-circuit: no other row shares this tmdb_link, so there is
    -- nothing to merge. This is the authoritative test — a loser Films row with
    -- no UserFilms owner must still be caught, so we cannot gate on v_users.
    IF NOT EXISTS (
        SELECT 1 FROM "Films"
        WHERE tmdb_link = v_tmdb AND film_slug <> p_film_slug
    ) THEN
        RETURN 0;
    END IF;

    -- Owners of a loser row, captured BEFORE mutating so their histogram can be
    -- recomputed after. NULL if no user holds a loser slug (deletes still run).
    SELECT array_agg(DISTINCT uf.lbusername) INTO v_users
    FROM "UserFilms" uf
    JOIN "Films" lf ON lf.film_slug = uf.film_slug
    WHERE lf.tmdb_link = v_tmdb AND lf.film_slug <> p_film_slug;

    -- Promote one loser row per owner who lacks the canonical row, so they keep
    -- the film; their remaining loser rows are deleted below.
    UPDATE "UserFilms" uf
    SET film_slug = p_film_slug
    FROM (
        SELECT DISTINCT ON (lu.lbusername) lu.lbusername, lu.film_slug AS loser_slug
        FROM "UserFilms" lu
        JOIN "Films" lf ON lf.film_slug = lu.film_slug
        WHERE lf.tmdb_link = v_tmdb
          AND lf.film_slug <> p_film_slug
          AND NOT EXISTS (
              SELECT 1 FROM "UserFilms" c
              WHERE c.lbusername = lu.lbusername AND c.film_slug = p_film_slug)
        ORDER BY lu.lbusername,
                 (lu.rating IS NOT NULL AND lu.rating > 0) DESC,
                 lu.rating DESC NULLS LAST,
                 lu.updated_at DESC NULLS LAST,
                 lu.film_slug ASC
    ) p
    WHERE uf.lbusername = p.lbusername AND uf.film_slug = p.loser_slug;

    DELETE FROM "UserFilms" uf USING "Films" lf
     WHERE uf.film_slug = lf.film_slug
       AND lf.tmdb_link = v_tmdb AND lf.film_slug <> p_film_slug;

    DELETE FROM "FilmRatings" fr USING "Films" lf
     WHERE fr.film_slug = lf.film_slug
       AND lf.tmdb_link = v_tmdb AND lf.film_slug <> p_film_slug;

    -- Loser Films deleted LAST — the deletes above join Films to find losers.
    DELETE FROM "Films"
     WHERE tmdb_link = v_tmdb AND film_slug <> p_film_slug;
    GET DIAGNOSTICS v_merged = ROW_COUNT;

    IF v_users IS NOT NULL THEN
        PERFORM refresh_user_ratings(u) FROM unnest(v_users) AS u;
    END IF;

    RETURN v_merged;
END;
$$;

ALTER FUNCTION "public"."upsert_film_and_merge_duplicates"(
    "text", "text", real, "text", "text", "text", "text", integer
) OWNER TO "postgres";
