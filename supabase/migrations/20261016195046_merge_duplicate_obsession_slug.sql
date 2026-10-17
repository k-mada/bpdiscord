-- Merge the stale Letterboxd slug obsession-2025-2 into canonical obsession-2025.
-- Both are the same film (TMDB 1339713); Letterboxd re-slugged it between scrape
-- passes, so the old slug (22 UserFilms rows) coexisted with the new canonical one
-- (31 rows). 21 users held both, which double-counted the film in every slug-keyed
-- feature. Survivor is obsession-2025: it is the current Letterboxd slug and holds
-- more rows, so its ratings win on conflict. Idempotent: a second run finds no
-- obsession-2025-2 rows and does nothing.

BEGIN;

UPDATE "UserFilms" AS uf
SET film_slug = 'obsession-2025'
WHERE uf.film_slug = 'obsession-2025-2'
  AND NOT EXISTS (
    SELECT 1 FROM "UserFilms" AS c
    WHERE c.lbusername = uf.lbusername
      AND c.film_slug = 'obsession-2025'
  );

DELETE FROM "UserFilms" WHERE film_slug = 'obsession-2025-2';

DELETE FROM "Films" WHERE film_slug = 'obsession-2025-2';

COMMIT;
