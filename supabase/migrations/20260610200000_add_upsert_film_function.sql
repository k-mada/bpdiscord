-- upsert_film: never-clobber-non-NULL upsert for the Films table.
--
-- Why: moviemaestro's per-user scraper runs batches that are heterogeneous in
-- which columns letterboxdpy successfully parses. A retry where release_year
-- (or any other metadata column) failed to parse must not overwrite a value
-- that a prior, more complete scrape already stored. supabase-py's .upsert()
-- can't express "skip NULLs" per-column, so the rule moves into SQL via
-- COALESCE(EXCLUDED.col, "Films".col) on every updatable column.
--
-- film_slug is the conflict target (PK); created_at is preserved by INSERT-
-- only behavior; updated_at is bumped to now() unconditionally on UPDATE.

CREATE OR REPLACE FUNCTION "public"."upsert_film"(
    "p_film_slug"    "text",
    "p_title"        "text",
    "p_lb_rating"    real,
    "p_url"          "text",
    "p_tmdb_link"    "text",
    "p_poster"       "text",
    "p_banner"       "text",
    "p_release_year" integer
)
RETURNS void
    LANGUAGE "sql"
    AS $$
    INSERT INTO "Films" (
        film_slug, title, lb_rating, url, tmdb_link,
        poster, banner, release_year, updated_at
    )
    VALUES (
        p_film_slug, p_title, p_lb_rating, p_url, p_tmdb_link,
        p_poster, p_banner, p_release_year, now()
    )
    ON CONFLICT (film_slug) DO UPDATE SET
        title        = COALESCE(EXCLUDED.title,        "Films".title),
        lb_rating    = COALESCE(EXCLUDED.lb_rating,    "Films".lb_rating),
        url          = COALESCE(EXCLUDED.url,          "Films".url),
        tmdb_link    = COALESCE(EXCLUDED.tmdb_link,    "Films".tmdb_link),
        poster       = COALESCE(EXCLUDED.poster,       "Films".poster),
        banner       = COALESCE(EXCLUDED.banner,       "Films".banner),
        release_year = COALESCE(EXCLUDED.release_year, "Films".release_year),
        updated_at   = now();
$$;

ALTER FUNCTION "public"."upsert_film"(
    "text", "text", real, "text", "text", "text", "text", integer
) OWNER TO "postgres";
