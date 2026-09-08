-- Give UserFilms/UserRatings the FK to Users they never had, so deleting a
-- profile cascades its movie data instead of silently orphaning it — the guard
-- for both the admin delete endpoint and any manual Supabase Studio delete.
-- MFLUserPicks already cascades; app_users already SET NULLs.

-- Sweep pre-existing orphans first: an FK cannot VALIDATE while child rows
-- reference a missing parent. Today the only orphan is a 'SynThur' casing
-- straggler from before username lowercasing (its lowercase 'synthur' profile
-- keeps 1660 films; the 2 SynThur-only films re-scrape on the next refresh).
-- Written as a general NOT EXISTS sweep so the migration is self-sufficient
-- rather than trusting the audit to still hold at deploy time.
DELETE FROM "public"."UserFilms" AS "uf"
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."Users" AS "u" WHERE "u"."lbusername" = "uf"."lbusername"
);

DELETE FROM "public"."UserRatings" AS "ur"
WHERE NOT EXISTS (
    SELECT 1 FROM "public"."Users" AS "u" WHERE "u"."lbusername" = "ur"."username"
);

-- NOT VALID splits the exclusive-lock DDL from the row scan: the ADD takes a
-- brief lock, VALIDATE re-checks existing rows under a weaker lock.
ALTER TABLE "public"."UserFilms"
    ADD CONSTRAINT "UserFilms_lbusername_fkey"
    FOREIGN KEY ("lbusername") REFERENCES "public"."Users"("lbusername")
    ON DELETE CASCADE NOT VALID;

ALTER TABLE "public"."UserRatings"
    ADD CONSTRAINT "UserRatings_username_fkey"
    FOREIGN KEY ("username") REFERENCES "public"."Users"("lbusername")
    ON DELETE CASCADE NOT VALID;

ALTER TABLE "public"."UserFilms" VALIDATE CONSTRAINT "UserFilms_lbusername_fkey";
ALTER TABLE "public"."UserRatings" VALIDATE CONSTRAINT "UserRatings_username_fkey";
