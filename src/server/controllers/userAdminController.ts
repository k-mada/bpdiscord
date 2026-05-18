// Admin-only user management surface. Mounted at /api/admin/users via
// userAdminRoutes; gated at the router level by authenticateToken +
// authorizeAdmin. See bpdiscord-dk7.
//
// Endpoints:
//   GET    /api/admin/users        — list accounts (Drizzle app_users +
//                                    supabase.auth.admin.listUsers, merged)
//   PUT    /api/admin/users/:id    — patch { email?, name?, lbusername? }
//                                    (lbusername is lenient: auto-stubs Users
//                                    + enqueues scrape, same as signup)
//   DELETE /api/admin/users/:id    — supabase.auth.admin.deleteUser; FK
//                                    cascades remove the app_users row.

import { Request, Response } from "express";
import { and, eq, ne, sql } from "drizzle-orm";
import { createSupabaseAdminClient } from "../config/database";
import { db } from "../db";
import { appUsers, users, userScrapeJobs } from "../db/schema";
import { LBUSERNAME_FORMAT, normalizeLbusername } from "../lib/lbusername";

// Default page size for supabase.auth.admin.listUsers. The Discord is far
// below this for the foreseeable future; if list responses ever return exactly
// LIST_PAGE_SIZE rows we log a warning so we know to paginate.
const LIST_PAGE_SIZE = 1000;

interface AccountView {
  id: string;
  email: string | null;
  name: string | null;
  lbusername: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

type AuthUserLike = {
  id: string;
  email?: string | null;
  user_metadata?: { name?: string | null } & Record<string, unknown>;
};

type AppUsersRow = {
  id: string;
  lbusername: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function mergeAccount(authUser: AuthUserLike, appUserRow: AppUsersRow | null): AccountView {
  return {
    id: authUser.id,
    email: authUser.email ?? null,
    name: (authUser.user_metadata?.name as string | undefined) ?? null,
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

export class UserAdminController {
  static async list(_req: Request, res: Response): Promise<void> {
    try {
      const admin = createSupabaseAdminClient();
      const [appUsersRows, { data: authData, error: listErr }] = await Promise.all([
        db.select().from(appUsers),
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

      const merged: AccountView[] = [];
      for (const [id, authUser] of authUsersById) {
        const appRow = appUsersById.get(id);
        if (!appRow) {
          // Synthesize-and-warn: auth user exists with no app_users row. Per
          // Stage 1 backfill + signup invariants this shouldn't happen, but
          // we surface them so they're visible to the admin instead of silently
          // missing from the list.
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

      // Sort by createdAt desc, nulls last (newest accounts first; synthesized
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
      const { email, name, lbusername: rawLbusername } = req.body as {
        email?: string;
        name?: string;
        lbusername?: string | null;
      };

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
          res.status(400).json({
            error:
              "Letterboxd.com usernames must be 2–15 characters; letters, numbers, hyphens, underscores only.",
          });
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

      // Fast-path conflict check: if a non-null lbusername is being claimed by
      // a different account, return 409. The unique constraint at insert is
      // the actual gate (race-safe).
      //
      // We deliberately do NOT name the existing claimer in the response.
      // The admin can already enumerate accounts via GET /api/admin/users;
      // baking the claimer's identity into a conflict error response inlines
      // PII into an error path and is a pattern that ages badly if the
      // validation is ever reused on a less-privileged surface.
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

      // Email / name update via Supabase admin SDK. We merge the existing
      // user_metadata so we don't accidentally wipe `role: "admin"` etc.
      let requiresReauth = false;
      if (email !== undefined || name !== undefined) {
        const updatePayload: {
          email?: string;
          email_confirm?: boolean;
          user_metadata?: Record<string, unknown>;
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

      // lbusername write via Drizzle. Lenient model: auto-upsert Users stub
      // (with is_discord=true) if linking; enqueue a scrape for newly-created
      // rows. xmax trick distinguishes fresh INSERT (xmax=0) from CONFLICT
      // UPDATE so we don't enqueue scrapes for existing rows.
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

            // Upsert app_users so this also handles the "auth user exists but
            // app_users row was never inserted" edge case (#10 from the plan
            // review — happens if a user was created outside our signup flow).
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

      // Build the response from the pre-update auth user + the patches we
      // know were applied, rather than round-tripping through getUserById a
      // second time. Avoids a needless SDK call, dodges any race window
      // between update and refresh, and means we don't have to null-guard
      // a refresh response that could theoretically fail.
      const updatedAuthUser: AuthUserLike = {
        id: currentData.user.id,
        email: email !== undefined ? email : (currentData.user.email ?? null),
        user_metadata:
          name !== undefined
            ? { ...(currentData.user.user_metadata ?? {}), name }
            : (currentData.user.user_metadata ?? {}),
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

  static async remove(req: Request, res: Response): Promise<void> {
    try {
      const id = req.params.id!;

      // Self-deletion guard. The admin's JWT would invalidate mid-request
      // and the cascade would leave them unable to log back in. Force admins
      // to delete their own accounts via a separate, deliberate path (or
      // SQL/Studio) so it can't happen by accident.
      if (req.user?.id === id) {
        res.status(400).json({
          error:
            "Cannot delete your own account via this endpoint. Use a different admin or the Supabase Studio for self-deletion.",
        });
        return;
      }

      const adminClient = createSupabaseAdminClient();
      const { error: deleteErr } = await adminClient.auth.admin.deleteUser(id);
      if (deleteErr) {
        const code = errorCode(deleteErr);
        if (code === "user_not_found" || deleteErr.message?.toLowerCase().includes("not found")) {
          res.status(404).json({ error: "Account not found." });
          return;
        }
        console.error("auth.admin.deleteUser failed:", deleteErr);
        res.status(500).json({ error: "Failed to delete account." });
        return;
      }

      // The FK from app_users.id → auth.users(id) ON DELETE CASCADE removes
      // the app_users row automatically. user_scrape_jobs.started_by has no
      // FK, so historical job rows persist (acceptable — they're audit logs).
      res.status(200).json({ data: { id, deleted: true } });
    } catch (err) {
      console.error("Admin delete error:", err);
      res.status(500).json({ error: "Internal server error" });
    }
  }
}
