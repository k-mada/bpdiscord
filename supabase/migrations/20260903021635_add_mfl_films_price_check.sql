-- The bulk upload validates price as a non-negative integer in TypeScript, but
-- the row-level admin CRUD will be a second writer and a client type is
-- bypassable by a direct API call. Enforce the invariant where every writer
-- meets it.

-- MFLFilms was created 2026-09-01 and is populated only by the admin upload,
-- so this is expected to validate against an empty or clean table. If it fails,
-- a negative price is real data that needs a decision, not a NOT VALID escape.
ALTER TABLE "public"."MFLFilms"
    ADD CONSTRAINT "mfl_films_price_non_negative" CHECK ("price" >= 0);
