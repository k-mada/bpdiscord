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
 * Delete a user completely: the Letterboxd profile ("Users") and all of its
 * movie data (UserFilms / UserRatings / MFLUserPicks) AND the linked login
 * (auth.users, which cascades app_users). Films / FilmRatings are shared
 * aggregates and are kept.
 *
 * Handles all three states — claimed (both sides), unclaimed profile (data
 * only), and login-only (account only) — resolving whichever identifier is
 * missing through app_users.
 *
 * Not one atomic transaction: the profile+data delete runs in a Postgres
 * transaction, then the auth account is deleted through the Supabase admin SDK
 * (a separate system). Ordered DB-first so a failed auth delete leaves a
 * retryable state — re-invoking with the same identifier finishes the job.
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

  // Resolve the missing identifier through app_users so we act on both sides.
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

  // Self-delete guard: cascading the acting admin's own account invalidates
  // their in-flight JWT mid-request. Blocked for everyone (bpdiscord-xng).
  if (accountId !== null && accountId === actingUserId) {
    return {
      status: 400,
      body: {
        error:
          "Cannot delete your own account via this endpoint. Use a different admin or Supabase Studio.",
      },
    };
  }

  // Children deleted explicitly (not left to the FK cascade) so the counts are
  // exact and the routine works whether or not the cascade migration is applied.
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

  // Auth account (cascades app_users). Skipped for unclaimed profiles.
  let accountDeleted = false;
  if (accountId !== null) {
    const admin = createSupabaseAdminClient();
    const { error } = await admin.auth.admin.deleteUser(accountId);
    if (error) {
      const notFound =
        errorCode(error) === "user_not_found" ||
        error.message?.toLowerCase().includes("not found");
      if (!notFound) {
        console.error("auth.admin.deleteUser failed during account delete:", error);
        // DB-first ordering means the profile is already gone; report the
        // partial state so the admin can retry (idempotent).
        return {
          status: 502,
          body: {
            error: "Deleted the profile and its data, but failed to delete the login account.",
            data: {
              lbusername,
              accountId,
              profileDeleted,
              accountDeleted: false,
              counts,
            },
          },
        };
      }
    } else {
      accountDeleted = true;
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
