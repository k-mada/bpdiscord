-- is_discord is the Stats audience gate: true = Discord member (registered or
-- not), false = a profile added for comparison only.

-- A profile linked to a site account is a Discord member by definition.
UPDATE "public"."Users" AS "u"
SET "is_discord" = true
FROM "public"."app_users" AS "a"
WHERE "a"."lbusername" = "u"."lbusername"
  AND "u"."is_discord" IS NOT TRUE;

-- NULL was already excluded by every `is_discord = true` filter, so folding it
-- to false changes no Stats total.
UPDATE "public"."Users"
SET "is_discord" = false
WHERE "is_discord" IS NULL;

ALTER TABLE "public"."Users"
    ALTER COLUMN "is_discord" SET NOT NULL;
