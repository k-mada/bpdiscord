/**
 * Seed script to populate the Events tables with Oscars 2026 data
 * from the existing oscars2026.json file.
 *
 * Usage: source src/server/.env && npx tsx src/server/scripts/seedOscars2026.ts
 *
 * Or: DOTENV_CONFIG_PATH=src/server/.env npx tsx --require dotenv/config src/server/scripts/seedOscars2026.ts
 */

import { eq } from "drizzle-orm";
import { db } from "../db";
import { awardShows, events, eventCategories, eventNominees } from "../db/schema";
import oscarsData from "../../client/data/oscars2026.json";

interface OscarsPrediction {
  title: string;
  subtitle: string;
}

interface OscarsCategory {
  order: number;
  category: string;
  nominees: OscarsPrediction[];
  pick_sean: OscarsPrediction;
  pick_amanda: OscarsPrediction;
  winner: string;
  actual_winner: OscarsPrediction[];
}

// Categories where the person name is the primary display (title field = person name)
const PERSON_FIRST_CATEGORIES = [
  "Director",
  "Actor in a Leading Role",
  "Actress in a Leading Role",
  "Best Actor in a Supporting Role",
  "Best Actress in a Supporting Role",
];

function getDisplayMode(categoryName: string): "person_first" | "movie_first" {
  return PERSON_FIRST_CATEGORIES.includes(categoryName)
    ? "person_first"
    : "movie_first";
}

/**
 * Maps an OscarsPrediction to person/movie names based on display mode.
 * For person_first categories: title = person name, subtitle = movie
 * For movie_first categories: title = movie name, subtitle = person (or empty)
 */
function mapNominee(
  prediction: OscarsPrediction,
  displayMode: "person_first" | "movie_first"
): { personName: string | null; movieOrShowName: string } {
  if (displayMode === "person_first") {
    return {
      personName: prediction.title || null,
      movieOrShowName: prediction.subtitle || prediction.title,
    };
  }
  // movie_first: title is the movie, subtitle is person (may be empty)
  return {
    personName: prediction.subtitle || null,
    movieOrShowName: prediction.title,
  };
}

async function seed() {
  const SLUG = "oscars-2026";
  const AWARD_SHOW_SLUG = "oscars";
  console.log("Seeding Oscars 2026 (98th Academy Awards) data...");

  // Find or create the award show
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
      .values({ name: "The Oscars", slug: AWARD_SHOW_SLUG })
      .returning();
    awardShowId = show!.id;
    console.log(`Created award show: The Oscars (${awardShowId})`);
  }

  // Check if event already exists (idempotency guard)
  const existing = await db
    .select({ id: events.id })
    .from(events)
    .where(eq(events.slug, SLUG));

  if (existing.length > 0) {
    console.log(`Event with slug "${SLUG}" already exists (id: ${existing[0]!.id}). Skipping seed.`);
    process.exit(0);
  }

  // Wrap in transaction so partial failures roll back cleanly
  await db.transaction(async (tx) => {
    // 1. Create the event
    const result = await tx
      .insert(events)
      .values({
        awardShowId,
        name: "The Oscars",
        slug: SLUG,
        year: oscarsData.year,
        editionNumber: 98,
        status: "active",
      })
      .returning();

    const event = result[0]!;
    console.log(`Created event: ${event.name} (${event.id})`);

    const categories = oscarsData.categories as OscarsCategory[];

    for (const cat of categories) {
      const displayMode = getDisplayMode(cat.category);

      // 2. Create the category
      const catResult = await tx
        .insert(eventCategories)
        .values({
          eventId: event.id,
          name: cat.category,
          displayOrder: cat.order,
          displayMode,
        })
        .returning();

      const category = catResult[0]!;
      console.log(`  Category: ${category.name} (${displayMode})`);

      // 3. Create nominees
      for (const nom of cat.nominees) {
        const { personName, movieOrShowName } = mapNominee(nom, displayMode);

        // Check if this nominee is a winner
        const isWinner = cat.actual_winner.some(
          (w) =>
            w.title.toLowerCase() === nom.title.toLowerCase() &&
            w.subtitle.toLowerCase() === nom.subtitle.toLowerCase()
        );

        await tx.insert(eventNominees).values({
          categoryId: category.id,
          personName,
          movieOrShowName,
          isWinner,
        });
      }

      console.log(`    ${cat.nominees.length} nominees added`);
    }
  });

  console.log("\nSeeding complete!");
  console.log(
    `\nNote: User picks (Sean/Amanda) were not seeded because they require Supabase user IDs.`
  );
  console.log(
    `To seed picks, update this script with actual Supabase user IDs for Sean and Amanda.`
  );

  process.exit(0);
}

seed().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
