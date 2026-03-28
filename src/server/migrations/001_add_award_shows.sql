-- Migration: Add AwardShows table and link Events to it
-- Run this in the Supabase SQL Editor (or any PostgreSQL client)
--
-- This migration:
--   1. Creates the AwardShows table
--   2. Adds award_show_id (FK) and edition_number columns to Events
--   3. Backfills AwardShows from existing event names
--   4. Links existing events to their award shows
--   5. Makes award_show_id NOT NULL
--   6. Adds an index for query performance

-- ============================================================
-- Step 1: Create AwardShows table
-- ============================================================
CREATE TABLE "AwardShows" (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR NOT NULL UNIQUE,
  slug VARCHAR NOT NULL UNIQUE,
  description VARCHAR,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Step 2: Add new columns to Events (nullable first for safe migration)
-- ============================================================
ALTER TABLE "Events" ADD COLUMN award_show_id UUID REFERENCES "AwardShows"(id);
ALTER TABLE "Events" ADD COLUMN edition_number INTEGER;

-- ============================================================
-- Step 3: Backfill — create award shows from existing event names
-- ============================================================
-- This generates slugs by lowercasing, stripping "The ", and replacing spaces with hyphens.
-- Example: "The Oscars" → "oscars", "The Golden Globes" → "golden-globes"
INSERT INTO "AwardShows" (name, slug)
SELECT DISTINCT name,
  LOWER(REPLACE(REPLACE(name, 'The ', ''), ' ', '-'))
FROM "Events"
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- Step 4: Backfill — link existing events to their award shows
-- ============================================================
UPDATE "Events" e
SET award_show_id = a.id
FROM "AwardShows" a
WHERE e.name = a.name;

-- ============================================================
-- Step 5: Enforce NOT NULL now that all rows are backfilled
-- ============================================================
-- IMPORTANT: Only run this after verifying Step 4 linked all events.
-- You can check with: SELECT count(*) FROM "Events" WHERE award_show_id IS NULL;
ALTER TABLE "Events" ALTER COLUMN award_show_id SET NOT NULL;

-- ============================================================
-- Step 6: Add index for the common join/filter pattern
-- ============================================================
CREATE INDEX idx_events_award_show_id ON "Events"(award_show_id);
