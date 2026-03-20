/**
 * Seed script to populate the Events tables with 2026 Golden Globe Awards
 * (83rd Golden Globes) data.
 *
 * Resumable: if interrupted mid-seed, re-running will pick up where it left off.
 * Each category + its nominees are inserted in a transaction. Already-seeded
 * categories are detected by name and skipped.
 *
 * Usage: npx tsx src/server/scripts/seedGoldenGlobes2026.ts
 */

import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { awardShows, events, eventCategories, eventNominees } from "../db/schema";
import globesData from "../../client/data/goldenglobes2026.json";

interface GlobesNominee {
  title: string;
  subtitle: string;
}

interface GlobesCategory {
  order: number;
  category: string;
  nominees: GlobesNominee[];
  actual_winner: GlobesNominee[];
}

// Categories where the person name is the primary display (title = person name, subtitle = film/show)
const PERSON_FIRST_CATEGORIES = [
  "Best Director - Motion Picture",
  "Best Actor - Motion Picture Drama",
  "Best Actress - Motion Picture Drama",
  "Best Actor - Motion Picture Musical or Comedy",
  "Best Actress - Motion Picture Musical or Comedy",
  "Best Supporting Actor - Motion Picture",
  "Best Supporting Actress - Motion Picture",
  "Best Actor - Television Series Drama",
  "Best Actress - Television Series Drama",
  "Best Actor - Television Series Musical or Comedy",
  "Best Actress - Television Series Musical or Comedy",
  "Best Actor - Limited Series or TV Movie",
  "Best Actress - Limited Series or TV Movie",
  "Best Supporting Actor - Television",
  "Best Supporting Actress - Television",
];

function getDisplayMode(categoryName: string): "person_first" | "movie_first" {
  return PERSON_FIRST_CATEGORIES.includes(categoryName)
    ? "person_first"
    : "movie_first";
}

/**
 * Maps a nominee entry to person/movie names based on display mode.
 * For person_first categories: title = person name, subtitle = film/show
 * For movie_first categories: title = film/show name, subtitle = person (or empty)
 */
function mapNominee(
  nominee: GlobesNominee,
  displayMode: "person_first" | "movie_first"
): { personName: string | null; movieOrShowName: string } {
  if (displayMode === "person_first") {
    return {
      personName: nominee.title || null,
      movieOrShowName: nominee.subtitle || nominee.title,
    };
  }
  return {
    personName: nominee.subtitle || null,
    movieOrShowName: nominee.title,
  };
}

async function seed() {
  const SLUG = "golden-globes-2026";
  const AWARD_SHOW_SLUG = "golden-globes";
  console.log("Seeding 2026 Golden Globe Awards (83rd Golden Globes) data...\n");

  // Step 0: Find or create the award show
  let awardShowId: string;
  const existingShow = await db
    .select({ id: awardShows.id })
    .from(awardShows)
    .where(eq(awardShows.slug, AWARD_SHOW_SLUG));

  if (existingShow.length > 0) {
    awardShowId = existingShow[0]!.id;
    console.log(`Award show found (${awardShowId})`);
  } else {
    const [show] = await db
      .insert(awardShows)
      .values({ name: "The Golden Globes", slug: AWARD_SHOW_SLUG })
      .returning();
    awardShowId = show!.id;
    console.log(`Created award show: The Golden Globes (${awardShowId})`);
  }

  // Step 1: Find or create the event
  let eventId: string;

  const existing = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, SLUG));

  if (existing.length > 0) {
    eventId = existing[0]!.id;
    console.log(`Event already exists (${eventId}), resuming seed...\n`);
  } else {
    const result = await db
      .insert(events)
      .values({
        awardShowId,
        name: "The Golden Globes",
        slug: SLUG,
        year: globesData.year,
        editionNumber: 83,
        nominationsDate: new Date("2025-12-09T00:00:00Z"),
        awardsDate: new Date("2026-01-11T00:00:00Z"),
        status: "active",
      })
      .returning();

    eventId = result[0]!.id;
    console.log(`Created event: The Golden Globes ${globesData.year} (${eventId})\n`);
  }

  // Step 2: Seed each category (skip already-seeded ones)
  const allCategories = globesData.categories as GlobesCategory[];
  let seeded = 0;
  let skipped = 0;

  for (const cat of allCategories) {
    const displayMode = getDisplayMode(cat.category);

    // Check if this category already exists for the event
    const existingCat = await db
      .select({ id: eventCategories.id })
      .from(eventCategories)
      .where(
        and(
          eq(eventCategories.eventId, eventId),
          eq(eventCategories.name, cat.category)
        )
      );

    if (existingCat.length > 0) {
      console.log(`  [skip] ${cat.category} (already seeded)`);
      skipped++;
      continue;
    }

    // Insert category + all its nominees in a single transaction
    // so we never end up with a half-seeded category
    await db.transaction(async (tx) => {
      const catResult = await tx
        .insert(eventCategories)
        .values({
          eventId,
          name: cat.category,
          displayOrder: cat.order,
          displayMode,
        })
        .returning();

      const categoryId = catResult[0]!.id;

      for (const nom of cat.nominees) {
        const { personName, movieOrShowName } = mapNominee(nom, displayMode);

        const isWinner = cat.actual_winner.some(
          (w) =>
            w.title.toLowerCase() === nom.title.toLowerCase() &&
            w.subtitle.toLowerCase() === nom.subtitle.toLowerCase()
        );

        await tx.insert(eventNominees).values({
          categoryId,
          personName,
          movieOrShowName,
          isWinner,
        });
      }
    });

    console.log(`  [seed] ${cat.category} (${displayMode}) — ${cat.nominees.length} nominees`);
    seeded++;
  }

  console.log(`\nDone! Seeded: ${seeded}, Skipped: ${skipped}, Total: ${allCategories.length}`);
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  console.error("\nRe-run the script to resume from where it left off.");
  process.exit(1);
});
