import { eq } from "drizzle-orm";
import { createSupabaseAdminClient } from "../config/database";
import { db } from "../db";
import { appUsers, mflUserPicks, userFilms, userRatings, users } from "../db/schema";

export interface DeleteUserInput {
  /** Supabase auth.users UUID, when entering from the account admin table. */
  accountId?: string;
  /** Letterboxd profile key, when entering from the profile side. */
  lbusername?: string;
  /** The admin performing the delete — used only for the self-delete guard. */
  actingUserId: string;
}

export interface DeleteUserOutcome {
  status: number;
  body: Record<string, unknown>;
}

interface DeletionCounts {
  userFilms: number;
  userRatings: number;
  mflPicks: number;
  profile: number;
}

function errorCode(e: unknown): string | undefined {
  if (typeof e === "object" && e !== null && "code" in e) {
    const code = (e as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/**
 * Delete a user completely: the Letterboxd profile ("Users") and its movie data
 * (UserFilms / UserRatings / MFLUserPicks) AND the linked login (auth.users,
 * which cascades app_users). Shared aggregates (Films / FilmRatings) are kept.
 *
 * Handles all three states — claimed, unclaimed profile, login-only — resolving
 * the missing identifier through app_users.
 *
 * Two systems, not one atomic transaction: DB profile+data first, then the auth
 * account via the Supabase admin SDK. DB-first so a failed auth delete leaves a
 * retryable 502 — but only a retry by `accountId` finishes it, since deleting
 * the profile SET-NULLs app_users.lbusername and the lbusername no longer
 * resolves the account.
 */
export async function deleteUserCompletely(
  input: DeleteUserInput,
): Promise<DeleteUserOutcome> {
  const { actingUserId } = input;
  const lbusernameArg = input.lbusername ?? null;
  const accountIdArg = input.accountId ?? null;

  if (lbusernameArg === null && accountIdArg === null) {
    return { status: 400, body: { error: "An account id or lbusername is required." } };
  }

  // Resolve the missing identifier through app_users.
  let accountId = accountIdArg;
  let lbusername = lbusernameArg;

  if (accountId !== null && lbusername === null) {
    const row = await db
      .select({ lbusername: appUsers.lbusername })
      .from(appUsers)
      .where(eq(appUsers.id, accountId))
      .limit(1);
    lbusername = row[0]?.lbusername ?? null;
  } else if (lbusername !== null && accountId === null) {
    const row = await db
      .select({ id: appUsers.id })
      .from(appUsers)
      .where(eq(appUsers.lbusername, lbusername))
      .limit(1);
    accountId = row[0]?.id ?? null;
  }

  // Self-delete would cascade the admin's own account and kill their in-flight
  // JWT. Blocked for everyone (bpdiscord-xng).
  if (accountId !== null && accountId === actingUserId) {
    return {
      status: 400,
      body: {
        error:
          "Cannot delete your own account via this endpoint. Use a different admin or Supabase Studio.",
      },
    };
  }

  // Delete children explicitly (not via cascade) for exact counts, and so this
  // works whether or not the migration is applied.
  const counts: DeletionCounts = { userFilms: 0, userRatings: 0, mflPicks: 0, profile: 0 };
  if (lbusername !== null) {
    await db.transaction(async (tx) => {
      const picks = await tx
        .delete(mflUserPicks)
        .where(eq(mflUserPicks.lbusername, lbusername!))
        .returning({ slug: mflUserPicks.filmSlug });
      const films = await tx
        .delete(userFilms)
        .where(eq(userFilms.lbusername, lbusername!))
        .returning({ slug: userFilms.filmSlug });
      const ratings = await tx
        .delete(userRatings)
        .where(eq(userRatings.username, lbusername!))
        .returning({ rating: userRatings.rating });
      const profile = await tx
        .delete(users)
        .where(eq(users.lbusername, lbusername!))
        .returning({ lbusername: users.lbusername });

      counts.mflPicks = picks.length;
      counts.userFilms = films.length;
      counts.userRatings = ratings.length;
      counts.profile = profile.length;
    });
  }

  const profileDeleted = counts.profile > 0;

  // Profile is already gone; surface the partial state so a retry-by-accountId
  // can finish the job.
  const partial502: DeleteUserOutcome = {
    status: 502,
    body: {
      error: "Deleted the profile and its data, but failed to delete the login account.",
      data: { lbusername, accountId, profileDeleted, accountDeleted: false, counts },
    },
  };

  // Auth account (cascades app_users). Skipped for unclaimed profiles.
  let accountDeleted = false;
  if (accountId !== null) {
    try {
      const admin = createSupabaseAdminClient();
      const { error } = await admin.auth.admin.deleteUser(accountId);
      if (error) {
        const notFound =
          errorCode(error) === "user_not_found" ||
          error.message?.toLowerCase().includes("not found");
        if (!notFound) {
          console.error("auth.admin.deleteUser failed during account delete:", error);
          return partial502;
        }
      } else {
        accountDeleted = true;
      }
    } catch (authErr) {
      // A throw (network, or a missing service-role key) is the same partial
      // state as a returned error — don't let it surface as a generic 500.
      console.error("auth.admin.deleteUser threw during account delete:", authErr);
      return partial502;
    }
  }

  // Nothing existed on either side.
  if (!profileDeleted && !accountDeleted) {
    return { status: 404, body: { error: "User not found." } };
  }

  return {
    status: 200,
    body: {
      data: {
        id: accountId,
        lbusername,
        deleted: true,
        profileDeleted,
        accountDeleted,
        counts,
      },
    },
  };
}
