-- Canonicalize Users.lbusername to lowercase and guard it going forward.
-- Letterboxd usernames are case-insensitive, but the PK is case-sensitive, so a
-- scraped display-cased row could diverge from the lowercase form the app treats
-- as canonical (normalizeLbusername). PR A merged the one collision; this
-- lowercases the 6 remaining mixed-case rows and installs a BEFORE INSERT trigger
-- so no writer -- signup, admin, or the moviemaestro worker -- can make a
-- case-twin again.

BEGIN;

-- The child FKs lacked ON UPDATE CASCADE, so a PK rename would orphan them.
-- Re-create each with its original ON DELETE action plus ON UPDATE CASCADE.
ALTER TABLE "UserFilms" DROP CONSTRAINT "UserFilms_lbusername_fkey";
ALTER TABLE "UserFilms" ADD CONSTRAINT "UserFilms_lbusername_fkey"
  FOREIGN KEY (lbusername) REFERENCES "Users"(lbusername) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "UserRatings" DROP CONSTRAINT "UserRatings_username_fkey";
ALTER TABLE "UserRatings" ADD CONSTRAINT "UserRatings_username_fkey"
  FOREIGN KEY (username) REFERENCES "Users"(lbusername) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE "MFLRosters" DROP CONSTRAINT "mfl_rosters_lbusername_fkey";
ALTER TABLE "MFLRosters" ADD CONSTRAINT "mfl_rosters_lbusername_fkey"
  FOREIGN KEY (lbusername) REFERENCES "Users"(lbusername) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE app_users DROP CONSTRAINT app_users_lbusername_users_fkey;
ALTER TABLE app_users ADD CONSTRAINT app_users_lbusername_users_fkey
  FOREIGN KEY (lbusername) REFERENCES "Users"(lbusername) ON UPDATE CASCADE ON DELETE SET NULL;

-- Rename every mixed-case key to lowercase; children follow via ON UPDATE CASCADE.
-- The PK aborts the migration if a lowercase twin exists (none must, after PR A).
UPDATE "Users" SET lbusername = lower(lbusername) WHERE lbusername <> lower(lbusername);

-- Normalize every future insert at the DB boundary, so a writer that forgets
-- (including the external worker) cannot reintroduce a case-twin.
CREATE OR REPLACE FUNCTION public.lowercase_lbusername()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.lbusername := lower(NEW.lbusername);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_lbusername_lowercase ON public."Users";
CREATE TRIGGER users_lbusername_lowercase
  BEFORE INSERT ON public."Users"
  FOR EACH ROW EXECUTE FUNCTION public.lowercase_lbusername();

COMMIT;
