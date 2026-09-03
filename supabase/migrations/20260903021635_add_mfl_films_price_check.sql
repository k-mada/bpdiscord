-- price >= 0 lived only in the bulk upload's TypeScript; the row-level CRUD
-- will be a second writer. See .claude/security.md section 6.

-- MFLFilms is new and admin-populated, so this validates against a clean table.
ALTER TABLE "public"."MFLFilms"
    ADD CONSTRAINT "mfl_films_price_non_negative" CHECK ("price" >= 0);
