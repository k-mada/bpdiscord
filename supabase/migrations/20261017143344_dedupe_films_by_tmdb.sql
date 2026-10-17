-- Collapse duplicate Films that share one TMDB id into a single canonical slug.
-- Letterboxd re-slugs a film when its title/date/linkage firms up; the worker keys
-- on the slug, so a re-slug inserts a fresh Films + UserFilms set and orphans the
-- old slug. Both rows keep the same tmdb_link, so slug-keyed features double-count.
-- A TMDB movie/tv id is one film, which is why it beats title+year (it merges
-- foreign-title and alternate-release variants that no title match would catch).
--
-- Canonical slug = newest Films.created_at (Letterboxd's current title), tiebroken
-- by most UserFilms rows, then slug asc. Excludes two unsafe groups: the /tv/0
-- placeholder id (shared by unrelated shows) and TMDB 1084409 (a suspected mislink
-- of two different films) — both are left for manual review. Idempotent: once a
-- group holds one slug the grouping no longer matches, so a re-run is a no-op.

BEGIN;

CREATE TEMP TABLE _film_merge_map ON COMMIT DROP AS
WITH grp AS (
  SELECT tmdb_link
  FROM "Films"
  WHERE tmdb_link ~ '/(movie|tv)/[1-9][0-9]*/?$'
    AND tmdb_link <> 'https://www.themoviedb.org/movie/1084409/'
  GROUP BY tmdb_link
  HAVING count(*) > 1
),
ranked AS (
  SELECT
    f.tmdb_link,
    f.film_slug,
    row_number() OVER (
      PARTITION BY f.tmdb_link
      ORDER BY
        f.created_at DESC,
        (SELECT count(*) FROM "UserFilms" uf WHERE uf.film_slug = f.film_slug) DESC,
        f.film_slug ASC
    ) AS rnk
  FROM "Films" f
  JOIN grp USING (tmdb_link)
)
SELECT
  r.film_slug AS loser_slug,
  c.film_slug AS canonical_slug
FROM ranked r
JOIN ranked c ON c.tmdb_link = r.tmdb_link AND c.rnk = 1
WHERE r.rnk > 1;

CREATE TEMP TABLE _promote ON COMMIT DROP AS
SELECT DISTINCT ON (uf.lbusername, m.canonical_slug)
  uf.lbusername,
  uf.film_slug AS loser_slug,
  m.canonical_slug
FROM "UserFilms" uf
JOIN _film_merge_map m ON uf.film_slug = m.loser_slug
WHERE NOT EXISTS (
  SELECT 1 FROM "UserFilms" c
  WHERE c.lbusername = uf.lbusername
    AND c.film_slug = m.canonical_slug
)
ORDER BY
  uf.lbusername,
  m.canonical_slug,
  (uf.rating IS NOT NULL AND uf.rating > 0) DESC,
  uf.rating DESC NULLS LAST,
  uf.updated_at DESC NULLS LAST,
  uf.film_slug ASC;

UPDATE "UserFilms" uf
SET film_slug = p.canonical_slug
FROM _promote p
WHERE uf.lbusername = p.lbusername
  AND uf.film_slug = p.loser_slug;

DELETE FROM "UserFilms" uf
USING _film_merge_map m
WHERE uf.film_slug = m.loser_slug;

DELETE FROM "FilmRatings" fr
USING _film_merge_map m
WHERE fr.film_slug = m.loser_slug;

DELETE FROM "Films" f
USING _film_merge_map m
WHERE f.film_slug = m.loser_slug;

COMMIT;
