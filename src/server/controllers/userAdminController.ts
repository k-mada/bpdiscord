import { Request, Response } from "express";
import { and, eq, isNull, ne, sql } from "drizzle-orm";
import { createSupabaseAdminClient } from "../config/database";
import { db } from "../db";
import { appUsers, mflRosters, users, userScrapeJobs } from "../db/schema";
import { isUniqueViolation } from "../db/utils";
import { LBUSERNAME_FORMAT, normalizeLbusername } from "../lib/lbusername";
import { deleteProfileData, deleteUserCompletely } from "../lib/deleteUser";
import { Role } from "../types";
import { callWorker, getWorkerConfig } from "./jobHelpers";
import {
  dbInsertRunningScrapeJob,
  dbMarkScrapeJobFailed,
} from "./userScrapeJobController";

const ROLES: readonly Role[] = ["member", "editor", "admin"];
const isRole = (value: unknown): value is Role =>
  typeof value === "string" && (ROLES as readonly string[]).includes(value);

// No pagination yet — a response of exactly this many rows logs a warning
// so we find out before accounts get silently truncated.
const LIST_PAGE_SIZE = 1000;

const LBUSERNAME_FORMAT_ERROR =
  "Letterboxd.com usernames must be 2–15 characters; letters, numbers, hyphens, underscores only.";
const PROFILE_NAME_MAX = 80;

interface AccountView {
  kind: "account";
  id: string;
  email: string | null;
  name: string | null;
  role: Role;
  lbusername: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

type AuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: { name?: string | null } & Record<string, unknown>;
  app_metadata?: { role?: Role } & Record<string, unknown>;
};

type AppUsersRow = {
  id: string;
  lbusername: string | null;
  createdAt: Date;
  updatedAt: Date;
};

/** A Letterboxd profile with no linked site account. */
interface ProfileView {
  kind: "profile";
  lbusername: string;
  name: string | null;
  isDiscord: boolean;
  createdAt: string | null;
}

interface ScrapeOutcome {
  started: boolean;
  jobId?: string;
  error?: string;
}

function mergeAccount(authUser: AuthUserLike, appUserRow: AppUsersRow | null): AccountView {
  return {
    kind: "account",
    id: authUser.id,
    email: authUser.email ?? null,
    name: (authUser.user_metadata?.name as string | undefined) ?? null,
    // Absent app_metadata.role (e.g. a post-migration signup) is the base
    // role, so the admin table always shows a concrete value.
    role: authUser.app_metadata?.role ?? "member",
    lbusername: appUserRow?.lbusername ?? null,
    createdAt: appUserRow?.createdAt?.toISOString() ?? null,
    updatedAt: appUserRow?.updatedAt?.toISOString() ?? null,
  };
}

function errorCode(e: unknown): string | undefined {
  if (typeof e === "object" && e !== null && "code" in e) {
    const code = (e as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function parseProfileName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 && trimmed.length <= PROFILE_NAME_MAX ? trimmed : null;
}

// Best-effort: the profile is already saved, so a failed handoff is reported
// rather than rolled back. The admin can retry from /fetcher.
async function startProfileScrape(
  lbusername: string,
  startedBy: string,
): Promise<ScrapeOutcome> {
  const config = getWorkerConfig();
  if (!config) return { started: false, error: "Worker not configured" };

  let jobId: string;
  try {
    const inserted = await dbInsertRunningScrapeJob(startedBy, lbusername);
    if (!inserted.ok) {
      return { started: true, jobId: inserted.conflictWithJobId };
    }
    jobId = inserted.jobId;
  } catch (e) {
    console.error("startProfileScrape: insert failed", e);
    return { started: false, error: "Failed to create scrape job" };
  }

  try {
    await callWorker(config, "/scrape-user", { job_id: jobId, lbusername });
    return { started: true, jobId };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error(`startProfileScrape: worker handoff failed for ${jobId}: ${message}`);
    try {
      await dbMarkScrapeJobFailed(jobId, `worker handoff failed: ${message}`);
    } catch (rollbackErr) {
      console.error("startProfileScrape: rollback also failed", rollbackErr);
    }
    return { started: false, error: "Worker unreachable" };
  }
}

class ProfileConflict extends Error {}
class ProfileNotFound extends Error {}

export class UserAdminController {
  static async list(_req: Request, res: Response): Promise<void> {
    try {
      const admin = createSupabaseAdminClient();
      const [appUsersRows, profileRows, { data: authData, error: listErr }] =
        await Promise.all([
          db.select().from(appUsers),
          db
            .select({
              lbusername: users.lbusername,
              name: users.displayName,
              isDiscord: users.isDiscord,
              createdAt: users.createdAt,
            })
            .from(users)
            .leftJoin(appUsers, eq(appUsers.lbusername, users.lbusername))
            .where(isNull(appUsers.id)),
          admin.auth.admin.listUsers({ page: 1, perPage: LIST_PAGE_SIZE }),
        ]);

      if (listErr) {
        console.error("auth.admin.listUsers failed:", listErr);
        res.status(502).json({ error: "Failed to list accounts from auth provider." });
        return;
      }

      if (authData.users.length >= LIST_PAGE_SIZE) {
        // Hit the pagination cap. The page is still returned but is incomplete.
        // Pagination is filed as future work; this warning makes the gap visible.
        console.warn(
          `auth.admin.listUsers returned ${authData.users.length} users; possible truncation at cap ${LIST_PAGE_SIZE}`,
        );
      }

      const appUsersById = new Map(appUsersRows.map((r) => [r.id, r as AppUsersRow]));
      const authUsersById = new Map(authData.users.map((u) => [u.id, u as AuthUserLike]));

      const merged: Array<AccountView | ProfileView> = [];
      for (const [id, authUser] of authUsersById) {
        const appRow = appUsersById.get(id);
        if (!appRow) {
          // Shouldn't happen given the signup invariants, but synthesize so
          // the account is visible to the admin rather than silently absent.
          console.warn(`auth user ${id} has no app_users row — synthesizing in admin list`);
        }
        merged.push(mergeAccount(authUser, appRow ?? null));
      }

      for (const [id] of appUsersById) {
        if (!authUsersById.has(id)) {
          // Phantom app_users row (no matching auth.users). FK should prevent
          // this; if it ever happens, log loudly and skip from the response.
          console.warn(`app_users row ${id} has no matching auth.users row — filtering from admin list`);
        }
      }

      for (const p of profileRows) {
        merged.push({
          kind: "profile",
          lbusername: p.lbusername,
          name: p.name,
          isDiscord: p.isDiscord,
          createdAt: p.createdAt?.toISOString() ?? null,
        });
      }

      // Sort by createdAt desc, nulls last (newest rows first; synthesized
      // rows with no createdAt end up at the bottom).
      merged.sort((a, b) => {
        if (a.createdAt === null && b.createdAt === null) return 0;
        if (a.createdAt === null) return 1;
        if (b.createdAt === null) return -1;
        return b.createdAt.localeCompare(a.createdAt);
      });

      res.status(200).json({ data: merged });
    } catch (err) {
      console.error("Admin list error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async update(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id!;
      const { email, name, role: rawRole, lbusername: rawLbusername } = req.body as {
        email?: string;
        name?: string;
        role?: unknown;
        lbusername?: string | null;
      };

      if (rawRole !== undefined && !isRole(rawRole)) {
        res.status(400).json({ error: "Invalid role." });
        return;
      }

      // Resolve the lbusername intent. `undefined` = no change. `null` =
      // unlink. A string is normalized + format-checked.
      let lbusernameUpdate: string | null | undefined;
      if (rawLbusername === null) {
        lbusernameUpdate = null;
      } else if (rawLbusername !== undefined) {
        const normalized = normalizeLbusername(rawLbusername);
        if (normalized === undefined) {
          // Empty/whitespace-only string → treat as unlink.
          lbusernameUpdate = null;
        } else if (!LBUSERNAME_FORMAT.test(normalized)) {
          res.status(400).json({ error: LBUSERNAME_FORMAT_ERROR });
          return;
        } else {
          lbusernameUpdate = normalized;
        }
      }

      // Confirm the account exists. Provides a clean 404 + gives us the
      // current user_metadata to merge with any name change.
      const admin = createSupabaseAdminClient();
      const { data: currentData, error: getErr } = await admin.auth.admin.getUserById(id);
      if (getErr || !currentData.user) {
        res.status(404).json({ error: "Account not found." });
        return;
      }

      // Resolve the role intent against the current role so a no-op passes.
      // An admin may not change their OWN role — blocks self-demotion and the
      // last-admin lockout it would cause.
      let roleUpdate: Role | undefined;
      if (rawRole !== undefined) {
        const currentRole =
          (currentData.user.app_metadata?.role as Role | undefined) ?? "member";
        if (rawRole !== currentRole) {
          if (req.user!.id === id) {
            res.status(403).json({ error: "You cannot change your own role." });
            return;
          }
          roleUpdate = rawRole;
        }
      }

      // Fast-path only; the unique constraint is the race-safe gate. The
      // response omits the existing claimer to keep PII out of error paths.
      if (lbusernameUpdate !== null && lbusernameUpdate !== undefined) {
        const existing = await db
          .select({ id: appUsers.id })
          .from(appUsers)
          .where(
            and(
              eq(appUsers.lbusername, lbusernameUpdate),
              ne(appUsers.id, id),
            ),
          )
          .limit(1);
        if (existing.length > 0) {
          res.status(409).json({
            error: "This Letterboxd.com username has already been claimed.",
          });
          return;
        }
      }

      // Email / name / role update via Supabase admin SDK. We merge the
      // existing metadata so we don't wipe sibling keys. Role goes into
      // app_metadata (service-role-only), never user_metadata.
      let requiresReauth = false;
      if (email !== undefined || name !== undefined || roleUpdate !== undefined) {
        const updatePayload: {
          email?: string;
          email_confirm?: boolean;
          user_metadata?: Record<string, unknown>;
          app_metadata?: Record<string, unknown>;
        } = {};

        if (email !== undefined) {
          updatePayload.email = email;
          // Skip the confirmation email — this is an admin-driven change.
          updatePayload.email_confirm = true;
          if (req.user!.id === id) {
            // Admin changed their own email; their current JWT rotates and
            // they'll need to log in again.
            requiresReauth = true;
          }
        }

        if (name !== undefined) {
          updatePayload.user_metadata = {
            ...(currentData.user.user_metadata ?? {}),
            name,
          };
        }

        if (roleUpdate !== undefined) {
          updatePayload.app_metadata = {
            ...(currentData.user.app_metadata ?? {}),
            role: roleUpdate,
          };
        }

        const { error: updateErr } = await admin.auth.admin.updateUserById(
          id,
          updatePayload,
        );
        if (updateErr) {
          console.error("auth.admin.updateUserById failed:", updateErr);
          res.status(500).json({ error: "Failed to update account." });
          return;
        }
      }

      // Lenient like signup: auto-stub the Users row when linking. xmax=0
      // marks a fresh INSERT so existing rows don't re-enqueue a scrape.
      let usersRowWasInserted = false;
      if (lbusernameUpdate !== undefined) {
        try {
          usersRowWasInserted = await db.transaction(async (tx) => {
            let wasInserted = false;
            if (lbusernameUpdate !== null) {
              const insertedUsers = await tx
                .insert(users)
                .values({ lbusername: lbusernameUpdate, isDiscord: true })
                .onConflictDoUpdate({
                  target: users.lbusername,
                  set: { isDiscord: true },
                })
                .returning({
                  lbusername: users.lbusername,
                  wasInserted: sql<boolean>`(xmax = 0)`,
                });
              wasInserted = insertedUsers[0]!.wasInserted;
            }

            // Upsert, not update — accounts created outside the signup flow
            // can have an auth user with no app_users row.
            await tx
              .insert(appUsers)
              .values({ id, lbusername: lbusernameUpdate })
              .onConflictDoUpdate({
                target: appUsers.id,
                set: { lbusername: lbusernameUpdate, updatedAt: new Date() },
              });

            return wasInserted;
          });
        } catch (dbErr) {
          if (errorCode(dbErr) === "23505") {
            res.status(409).json({
              error: "This Letterboxd.com username has already been claimed.",
            });
            return;
          }
          console.error("Admin update DB error:", dbErr);
          res.status(500).json({ error: "Internal server error during update." });
          return;
        }
      }

      // Best-effort scrape enqueue for newly-created Users stub rows. Logged
      // on failure but doesn't undo the update.
      if (usersRowWasInserted && lbusernameUpdate) {
        try {
          await db.insert(userScrapeJobs).values({
            lbusername: lbusernameUpdate,
            status: "pending",
            // The ADMIN initiated this scrape (not the target user) — they're
            // the one who will see the job in their job list.
            startedBy: req.user!.id,
          });
        } catch (scrapeErr) {
          console.error("Failed to enqueue scrape job at admin update:", scrapeErr);
        }
      }

      // Composed from the pre-update user + known patches rather than a second
      // getUserById — no extra SDK call, no race window between the two reads.
      const updatedAuthUser: AuthUserLike = {
        id: currentData.user.id,
        email: email !== undefined ? email : (currentData.user.email ?? null),
        user_metadata:
          name !== undefined
            ? { ...(currentData.user.user_metadata ?? {}), name }
            : (currentData.user.user_metadata ?? {}),
        app_metadata:
          roleUpdate !== undefined
            ? { ...(currentData.user.app_metadata ?? {}), role: roleUpdate }
            : (currentData.user.app_metadata ?? {}),
      };
      const refreshedAppRow = await db
        .select()
        .from(appUsers)
        .where(eq(appUsers.id, id))
        .limit(1);

      const view = mergeAccount(
        updatedAuthUser,
        (refreshedAppRow[0] as AppUsersRow | undefined) ?? null,
      );

      res.status(200).json({
        data: {
          ...view,
          ...(requiresReauth ? { requiresReauth: true } : {}),
        },
      });
    } catch (err) {
      console.error("Admin update error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async createProfile(req: Request, res: Response): Promise<void> {
    try {
      const { name: rawName, lbusername: rawLbusername } = req.body as {
        name?: unknown;
        lbusername?: unknown;
      };

      const name = parseProfileName(rawName);
      if (name === null) {
        res.status(400).json({
          error: `Name is required (1–${PROFILE_NAME_MAX} characters).`,
        });
        return;
      }
      const lbusername = normalizeLbusername(rawLbusername);
      if (lbusername === undefined || !LBUSERNAME_FORMAT.test(lbusername)) {
        res.status(400).json({ error: LBUSERNAME_FORMAT_ERROR });
        return;
      }

      // DO NOTHING, never DO UPDATE: an existing row (a Discord member above
      // all) must not be flipped to non-Discord by this endpoint.
      const inserted = await db
        .insert(users)
        .values({ lbusername, displayName: name, isDiscord: false })
        .onConflictDoNothing({ target: users.lbusername })
        .returning({ createdAt: users.createdAt });
      if (inserted.length === 0) {
        res.status(409).json({
          error: "A Letterboxd profile with this username already exists.",
        });
        return;
      }

      const profile: ProfileView = {
        kind: "profile",
        lbusername,
        name,
        isDiscord: false,
        createdAt: inserted[0]!.createdAt?.toISOString() ?? null,
      };
      const scrape = await startProfileScrape(lbusername, req.user!.id);

      res.status(201).json({ data: { profile, scrape } });
    } catch (err) {
      console.error("Admin create-profile error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Edit an unclaimed profile's name and/or Letterboxd username. A username
   * change deletes the old profile's data and recreates it under the new key
   * (then rescrapes) — a cascade rename would carry the old person's films over.
   */
  static async updateProfile(req: Request, res: Response): Promise<void> {
    try {
      const current = normalizeLbusername(req.params.lbusername)!;
      const { name: rawName, lbusername: rawLbusername } = req.body as {
        name?: unknown;
        lbusername?: unknown;
      };

      if (rawName === undefined && rawLbusername === undefined) {
        res.status(400).json({ error: "Nothing to update." });
        return;
      }

      let name: string | undefined;
      if (rawName !== undefined) {
        const parsed = parseProfileName(rawName);
        if (parsed === null) {
          res.status(400).json({
            error: `Name must be 1–${PROFILE_NAME_MAX} characters.`,
          });
          return;
        }
        name = parsed;
      }

      let next: string | undefined;
      if (rawLbusername !== undefined) {
        const normalized = normalizeLbusername(rawLbusername);
        if (normalized === undefined || !LBUSERNAME_FORMAT.test(normalized)) {
          res.status(400).json({ error: LBUSERNAME_FORMAT_ERROR });
          return;
        }
        if (normalized !== current) next = normalized;
      }

      let profile: ProfileView;
      try {
        profile = await db.transaction(async (tx) => {
          const [row] = await tx
            .select({
              displayName: users.displayName,
              isDiscord: users.isDiscord,
              createdAt: users.createdAt,
            })
            .from(users)
            .where(eq(users.lbusername, current))
            .for("update");
          if (!row) throw new ProfileNotFound();

          const claimed = await tx
            .select({ id: appUsers.id })
            .from(appUsers)
            .where(eq(appUsers.lbusername, current))
            .limit(1);
          // A claimed profile belongs to an account; edit it through the account.
          if (claimed.length > 0) throw new ProfileNotFound();

          const displayName = name ?? row.displayName;

          if (next === undefined) {
            await tx
              .update(users)
              .set({ displayName, updatedAt: new Date() })
              .where(eq(users.lbusername, current));
            return {
              kind: "profile" as const,
              lbusername: current,
              name: displayName,
              isDiscord: row.isDiscord,
              createdAt: row.createdAt?.toISOString() ?? null,
            };
          }

          const taken = await tx
            .select({ lbusername: users.lbusername })
            .from(users)
            .where(eq(users.lbusername, next))
            .limit(1);
          if (taken.length > 0) {
            throw new ProfileConflict(
              "A Letterboxd profile with this username already exists.",
            );
          }
          const rosters = await tx
            .select({ id: mflRosters.rosterId })
            .from(mflRosters)
            .where(eq(mflRosters.lbusername, current))
            .limit(1);
          if (rosters.length > 0) {
            throw new ProfileConflict(
              "This profile owns MFL rosters; changing its username would delete them.",
            );
          }

          await deleteProfileData(tx, current);
          const [created] = await tx
            .insert(users)
            .values({ lbusername: next, displayName, isDiscord: row.isDiscord })
            .returning({ createdAt: users.createdAt });
          return {
            kind: "profile" as const,
            lbusername: next,
            name: displayName,
            isDiscord: row.isDiscord,
            createdAt: created!.createdAt?.toISOString() ?? null,
          };
        });
      } catch (txErr) {
        if (txErr instanceof ProfileNotFound) {
          res.status(404).json({ error: "Profile not found." });
          return;
        }
        if (txErr instanceof ProfileConflict) {
          res.status(409).json({ error: txErr.message });
          return;
        }
        if (isUniqueViolation(txErr, "Users_pkey")) {
          res.status(409).json({
            error: "A Letterboxd profile with this username already exists.",
          });
          return;
        }
        throw txErr;
      }

      const scrape =
        next !== undefined
          ? await startProfileScrape(next, req.user!.id)
          : undefined;

      res.status(200).json({ data: { profile, ...(scrape ? { scrape } : {}) } });
    } catch (err) {
      console.error("Admin update-profile error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  /**
   * Delete an unclaimed profile and its data. Unlike DELETE /by-lbusername,
   * a profile an account owns is a 404 here, never a login-account delete.
   */
  static async removeProfile(req: Request, res: Response): Promise<void> {
    try {
      const lbusername = normalizeLbusername(req.params.lbusername)!;
      const counts = await db.transaction(async (tx) => {
        const [row] = await tx
          .select({ lbusername: users.lbusername })
          .from(users)
          .where(eq(users.lbusername, lbusername))
          .for("update");
        if (!row) return null;
        const claimed = await tx
          .select({ id: appUsers.id })
          .from(appUsers)
          .where(eq(appUsers.lbusername, lbusername))
          .limit(1);
        if (claimed.length > 0) return null;
        return deleteProfileData(tx, lbusername);
      });

      if (counts === null) {
        res.status(404).json({ error: "Profile not found." });
        return;
      }
      res.status(200).json({ data: { lbusername, deleted: true, counts } });
    } catch (err) {
      console.error("Admin delete-profile error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async remove(req: Request, res: Response): Promise<void> {
    try {
      const outcome = await deleteUserCompletely({
        accountId: req.params.id!,
        actingUserId: req.user!.id,
      });
      res.status(outcome.status).json(outcome.body);
    } catch (err) {
      console.error("Admin delete error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }

  static async removeByLbusername(req: Request, res: Response): Promise<void> {
    try {
      const lbusername = normalizeLbusername(req.params.lbusername);
      if (lbusername === undefined || !LBUSERNAME_FORMAT.test(lbusername)) {
        res.status(400).json({ error: "Invalid lbusername format." });
        return;
      }
      const outcome = await deleteUserCompletely({
        lbusername,
        actingUserId: req.user!.id,
      });
      res.status(outcome.status).json(outcome.body);
    } catch (err) {
      console.error("Admin delete-by-lbusername error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
