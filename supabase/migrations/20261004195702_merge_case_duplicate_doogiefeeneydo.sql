-- Merge the case-duplicate Letterboxd profile into its canonical lowercase row.
-- Users.lbusername is a case-sensitive PK, so DoogieFeeneyDO (scraped 2025) and
-- doogiefeeneydo (signup 2026) coexisted as two rows for one person. The survivor
-- is the lowercase row because it carries the app_users login; the loser carries
-- the 2025 profile scalars and ~20 films the survivor lacks. Idempotent: a second
-- run finds no loser row and does nothing. The forthcoming lowercasing guard
-- prevents any new case-twin from forming.

BEGIN;

UPDATE "Users" AS survivor
SET display_name    = COALESCE(survivor.display_name, loser.display_name),
    followers       = COALESCE(survivor.followers, loser.followers),
    following       = COALESCE(survivor.following, loser.following),
    number_of_lists = COALESCE(survivor.number_of_lists, loser.number_of_lists),
    updated_at      = now()
FROM "Users" AS loser
WHERE survivor.lbusername = 'doogiefeeneydo'
  AND loser.lbusername = 'DoogieFeeneyDO';

INSERT INTO "UserFilms" (created_at, film_slug, rating, lbusername, watched, updated_at, liked, title)
SELECT created_at, film_slug, rating, 'doogiefeeneydo', watched, updated_at, liked, title
FROM "UserFilms"
WHERE lbusername = 'DoogieFeeneyDO'
ON CONFLICT (lbusername, film_slug) DO NOTHING;

INSERT INTO "UserRatings" (created_at, username, rating, count, updated_at)
SELECT created_at, 'doogiefeeneydo', rating, count, updated_at
FROM "UserRatings"
WHERE username = 'DoogieFeeneyDO'
ON CONFLICT (username, rating) DO NOTHING;

-- Cascades the loser's remaining UserFilms / UserRatings (the overlap already
-- present on the survivor) via ON DELETE CASCADE.
DELETE FROM "Users" WHERE lbusername = 'DoogieFeeneyDO';

COMMIT;
