import { Request, Response } from "express";
import { ApiResponse } from "../../shared/types";

const VALID_STATUSES = ["active", "inactive"] as const;
const VALID_DISPLAY_MODES = ["movie_first", "person_first"] as const;
import {
  dbGetAwardShows,
  dbCreateAwardShow,
  dbUpdateAwardShow,
  dbGetEvents,
  dbGetEventBySlug,
  dbGetEventUserPicks,
  dbCreateEvent,
  dbUpdateEvent,
  dbUpsertCategory,
  dbDeleteCategory,
  dbUpsertNominee,
  dbDeleteNominee,
  dbSetWinner,
  dbUpsertUserPick,
} from "./eventDataController";

// ===========================
// Award Show Endpoints
// ===========================

export async function getAwardShows(_req: Request, res: Response): Promise<void> {
  const result = await dbGetAwardShows();

  if (result.success && result.data) {
    const response: ApiResponse = {
      message: "Award shows retrieved successfully",
      data: result.data,
    };
    res.json(response);
  } else {
    res.status(500).json({ error: result.error || "Failed to get award shows" });
  }
}

export async function createAwardShow(req: Request, res: Response): Promise<void> {
  const { name, slug, description } = req.body;
  if (!name || !slug) {
    res.status(400).json({ error: "name and slug are required" });
    return;
  }

  const result = await dbCreateAwardShow({ name, slug, description: description || null });

  if (result.success && result.data) {
    res.status(201).json({
      message: "Award show created successfully",
      data: result.data,
    });
  } else {
    res.status(500).json({ error: result.error || "Failed to create award show" });
  }
}

export async function updateAwardShow(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "Award show ID is required" });
    return;
  }

  const { name, slug, description } = req.body;
  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (slug !== undefined) updateData.slug = slug;
  if (description !== undefined) updateData.description = description;

  const result = await dbUpdateAwardShow(id, updateData);

  if (result.success) {
    res.json({ message: "Award show updated successfully" });
  } else {
    res.status(500).json({ error: result.error || "Failed to update award show" });
  }
}

// ===========================
// Public Endpoints
// ===========================

export async function getEvents(req: Request, res: Response): Promise<void> {
  const status = req.query.status as string | undefined;
  const result = await dbGetEvents(status);

  if (result.success && result.data) {
    const response: ApiResponse = {
      message: "Events retrieved successfully",
      data: result.data,
    };
    res.json(response);
  } else {
    res.status(500).json({ error: result.error || "Failed to get events" });
  }
}

export async function getEventBySlug(
  req: Request,
  res: Response,
): Promise<void> {
  const { slug } = req.params;

  if (!slug) {
    res.status(400).json({ error: "Event slug is required" });
    return;
  }

  const result = await dbGetEventBySlug(slug);

  if (result.success) {
    if (!result.data) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    // Flatten the nested awardShow relation for the client
    const { awardShow, ...eventFields } = result.data;
    const response: ApiResponse = {
      message: "Event retrieved successfully",
      data: {
        ...eventFields,
        awardShowId: awardShow?.id ?? eventFields.awardShowId,
        awardShowName: awardShow?.name ?? eventFields.name,
        awardShowSlug: awardShow?.slug ?? "",
      },
    };
    res.json(response);
  } else {
    res.status(500).json({ error: result.error || "Failed to get event" });
  }
}

// ===========================
// Authenticated Endpoints
// ===========================

export async function submitPick(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { categoryId, nomineeId } = req.body;
  if (!categoryId || !nomineeId) {
    res.status(400).json({ error: "categoryId and nomineeId are required" });
    return;
  }

  const result = await dbUpsertUserPick(categoryId, userId, nomineeId);

  if (result.success) {
    res.json({ message: "Pick submitted successfully" });
  } else {
    res.status(500).json({ error: result.error || "Failed to submit pick" });
  }
}

export async function getMyPicks(req: Request, res: Response): Promise<void> {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  const { slug } = req.params;
  if (!slug) {
    res.status(400).json({ error: "Event slug is required" });
    return;
  }

  // First get the event to get its ID
  const eventResult = await dbGetEventBySlug(slug);
  if (!eventResult.success || !eventResult.data) {
    res.status(404).json({ error: "Event not found" });
    return;
  }

  const result = await dbGetEventUserPicks(eventResult.data.id, userId);

  if (result.success && result.data) {
    const response: ApiResponse = {
      message: "Picks retrieved successfully",
      data: result.data,
    };
    res.json(response);
  } else {
    res.status(500).json({ error: result.error || "Failed to get picks" });
  }
}

// ===========================
// Admin Endpoints
// (admin authorization enforced by authorizeAdmin middleware in routes)
// ===========================

export async function createEvent(req: Request, res: Response): Promise<void> {
  const { awardShowId, name, slug, year, editionNumber, nominationsDate, awardsDate, status } = req.body;
  if (!awardShowId || !name || !slug || !year) {
    res.status(400).json({ error: "awardShowId, name, slug, and year are required" });
    return;
  }

  if (status && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    return;
  }

  const result = await dbCreateEvent({
    awardShowId,
    name,
    slug,
    year,
    editionNumber: editionNumber ?? null,
    nominationsDate: nominationsDate ? new Date(nominationsDate) : null,
    awardsDate: awardsDate ? new Date(awardsDate) : null,
    status: status || "active",
  });

  if (result.success && result.data) {
    res.status(201).json({
      message: "Event created successfully",
      data: result.data,
    });
  } else {
    res.status(500).json({ error: result.error || "Failed to create event" });
  }
}

export async function updateEvent(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "Event ID is required" });
    return;
  }

  const { name, slug, year, editionNumber, nominationsDate, awardsDate, status } = req.body;

  if (status !== undefined && !VALID_STATUSES.includes(status)) {
    res.status(400).json({ error: `status must be one of: ${VALID_STATUSES.join(", ")}` });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (slug !== undefined) updateData.slug = slug;
  if (year !== undefined) updateData.year = year;
  if (editionNumber !== undefined) updateData.editionNumber = editionNumber;
  if (nominationsDate !== undefined)
    updateData.nominationsDate = nominationsDate
      ? new Date(nominationsDate)
      : null;
  if (awardsDate !== undefined)
    updateData.awardsDate = awardsDate ? new Date(awardsDate) : null;
  if (status !== undefined) updateData.status = status;

  const result = await dbUpdateEvent(id, updateData);

  if (result.success) {
    res.json({ message: "Event updated successfully" });
  } else {
    res.status(500).json({ error: result.error || "Failed to update event" });
  }
}

export async function upsertCategory(
  req: Request,
  res: Response,
): Promise<void> {
  const { id, eventId, name, displayOrder, displayMode } = req.body;
  if (!eventId || !name || displayOrder === undefined) {
    res
      .status(400)
      .json({ error: "eventId, name, and displayOrder are required" });
    return;
  }

  if (displayMode && !VALID_DISPLAY_MODES.includes(displayMode)) {
    res.status(400).json({ error: `displayMode must be one of: ${VALID_DISPLAY_MODES.join(", ")}` });
    return;
  }

  const result = await dbUpsertCategory({
    id,
    eventId,
    name,
    displayOrder,
    displayMode: displayMode || "movie_first",
  });

  if (result.success) {
    res.json({
      message: "Category saved successfully",
      data: result.data,
    });
  } else {
    res.status(500).json({ error: result.error || "Failed to save category" });
  }
}

export async function deleteCategory(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "Category ID is required" });
    return;
  }

  const result = await dbDeleteCategory(id);

  if (result.success) {
    res.json({ message: "Category deleted successfully" });
  } else {
    res
      .status(500)
      .json({ error: result.error || "Failed to delete category" });
  }
}

export async function upsertNominee(
  req: Request,
  res: Response,
): Promise<void> {
  const { id, categoryId, personName, movieOrShowName, isWinner } = req.body;

  if (!categoryId || !movieOrShowName) {
    res
      .status(400)
      .json({ error: "categoryId and movieOrShowName are required" });
    return;
  }

  const result = await dbUpsertNominee({
    id,
    categoryId,
    personName: personName || null,
    movieOrShowName,
    isWinner: isWinner || false,
  });

  if (result.success) {
    res.json({
      message: "Nominee saved successfully",
      data: result.data,
    });
  } else {
    res.status(500).json({ error: result.error || "Failed to save nominee" });
  }
}

export async function deleteNominee(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params;
  if (!id) {
    res.status(400).json({ error: "Nominee ID is required" });
    return;
  }

  const result = await dbDeleteNominee(id);

  if (result.success) {
    res.json({ message: "Nominee deleted successfully" });
  } else {
    res.status(500).json({ error: result.error || "Failed to delete nominee" });
  }
}

export async function setWinner(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { isWinner } = req.body;

  if (!id) {
    res.status(400).json({ error: "Nominee ID is required" });
    return;
  }

  if (typeof isWinner !== "boolean") {
    res.status(400).json({ error: "isWinner must be a boolean" });
    return;
  }

  const result = await dbSetWinner(id, isWinner);

  if (result.success) {
    res.json({ message: "Winner status updated successfully" });
  } else {
    res
      .status(500)
      .json({ error: result.error || "Failed to update winner status" });
  }
}
