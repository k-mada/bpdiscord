import { eq, asc, and } from "drizzle-orm";
import { db } from "../db";
import {
  events,
  eventCategories,
  eventNominees,
  eventUserPicks,
  NewEvent,
  NewEventCategory,
  NewEventNominee,
} from "../db/schema";
import { dbOperation, dbMutation } from "../db/utils";

// ===========================
// Read Operations
// ===========================

export async function dbGetEvents(status?: string) {
  return dbOperation(async () => {
    const query = db
      .select({
        id: events.id,
        name: events.name,
        slug: events.slug,
        year: events.year,
        nominationsDate: events.nominationsDate,
        awardsDate: events.awardsDate,
        status: events.status,
        createdAt: events.createdAt,
        updatedAt: events.updatedAt,
      })
      .from(events)
      .orderBy(asc(events.year));

    if (status) {
      return query.where(eq(events.status, status));
    }

    return query;
  });
}

export async function dbGetEventBySlug(slug: string) {
  return dbOperation(async () => {
    const result = await db.query.events.findFirst({
      where: eq(events.slug, slug),
      with: {
        categories: {
          orderBy: [asc(eventCategories.displayOrder)],
          with: {
            nominees: true,
          },
        },
      },
    });

    return result ?? null;
  });
}

export async function dbGetEventUserPicks(eventId: string, userId: string) {
  return dbOperation(async () => {
    // Get all category IDs for this event, then get picks for those categories
    const result = await db
      .select({
        id: eventUserPicks.id,
        categoryId: eventUserPicks.categoryId,
        userId: eventUserPicks.userId,
        nomineeId: eventUserPicks.nomineeId,
        createdAt: eventUserPicks.createdAt,
        updatedAt: eventUserPicks.updatedAt,
      })
      .from(eventUserPicks)
      .innerJoin(
        eventCategories,
        eq(eventUserPicks.categoryId, eventCategories.id)
      )
      .where(
        and(
          eq(eventCategories.eventId, eventId),
          eq(eventUserPicks.userId, userId)
        )
      );

    return result;
  });
}

// ===========================
// Write Operations (Admin)
// ===========================

export async function dbCreateEvent(data: Omit<NewEvent, "id" | "createdAt" | "updatedAt">) {
  return dbOperation(async () => {
    const result = await db
      .insert(events)
      .values({
        ...data,
        updatedAt: new Date(),
      })
      .returning();

    return result[0];
  });
}

export async function dbUpdateEvent(
  id: string,
  data: Partial<Omit<NewEvent, "id" | "createdAt">>
) {
  return dbMutation(async () => {
    await db
      .update(events)
      .set({
        ...data,
        updatedAt: new Date(),
      })
      .where(eq(events.id, id));
  });
}

export async function dbUpsertCategory(
  data: Omit<NewEventCategory, "id" | "createdAt" | "updatedAt"> & { id?: string }
) {
  return dbOperation(async () => {
    if (data.id) {
      // Update existing
      const { id, ...updateData } = data;
      await db
        .update(eventCategories)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(eventCategories.id, id));
      return { id };
    } else {
      // Insert new
      const result = await db
        .insert(eventCategories)
        .values({
          ...data,
          updatedAt: new Date(),
        })
        .returning({ id: eventCategories.id });
      return result[0];
    }
  });
}

export async function dbDeleteCategory(id: string) {
  return dbMutation(async () => {
    await db.delete(eventCategories).where(eq(eventCategories.id, id));
  });
}

export async function dbUpsertNominee(
  data: Omit<NewEventNominee, "id" | "createdAt" | "updatedAt"> & { id?: string }
) {
  return dbOperation(async () => {
    if (data.id) {
      const { id, ...updateData } = data;
      await db
        .update(eventNominees)
        .set({
          ...updateData,
          updatedAt: new Date(),
        })
        .where(eq(eventNominees.id, id));
      return { id };
    } else {
      const result = await db
        .insert(eventNominees)
        .values({
          ...data,
          updatedAt: new Date(),
        })
        .returning({ id: eventNominees.id });
      return result[0];
    }
  });
}

export async function dbDeleteNominee(id: string) {
  return dbMutation(async () => {
    await db.delete(eventNominees).where(eq(eventNominees.id, id));
  });
}

export async function dbSetWinner(nomineeId: string, isWinner: boolean) {
  return dbMutation(async () => {
    await db
      .update(eventNominees)
      .set({
        isWinner,
        updatedAt: new Date(),
      })
      .where(eq(eventNominees.id, nomineeId));
  });
}

export async function dbUpsertUserPick(
  categoryId: string,
  userId: string,
  nomineeId: string
) {
  return dbMutation(async () => {
    await db
      .insert(eventUserPicks)
      .values({
        categoryId,
        userId,
        nomineeId,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [eventUserPicks.categoryId, eventUserPicks.userId],
        set: {
          nomineeId,
          updatedAt: new Date(),
        },
      });
  });
}
