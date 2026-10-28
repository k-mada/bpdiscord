import * as readline from "readline";
import { createSupabaseAdminClient } from "../config/database";
import type { User } from "@supabase/supabase-js";

/**
 * One-off: move the role claim from user_metadata (end-user-writable, a
 * privilege-escalation vector) to app_metadata (service-role-only).
 *
 * For each auth user it sets app_metadata.role — preserving admin, mapping
 * legacy "user" to "member", defaulting the rest to "member" — and clears
 * user_metadata.role. Idempotent: an account whose app_metadata.role is
 * already set is left untouched, and a cleared legacy role is not re-cleared.
 *
 * Targets whatever Supabase project loadEnv resolves (prod by default).
 * Run: yarn backfill:roles [--dry-run]
 */

const PER_PAGE = 1000;

function parseDryRun(argv: string[]): boolean {
  for (const arg of argv) {
    if (arg === "--dry-run") return true;
    if (arg === "--help" || arg === "-h") {
      console.log("Usage: yarn backfill:roles [--dry-run]");
      process.exit(0);
    }
    console.error(`Unknown arg: ${arg}`);
    process.exit(1);
  }
  return false;
}

async function confirm(message: string): Promise<boolean> {
  if (!process.stdin.isTTY) {
    console.error("Non-interactive shell — confirmation requires a TTY. Aborting.");
    return false;
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => rl.question(message, resolve));
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

interface Plan {
  appRole: "admin" | "member" | undefined;
  clearLegacy: boolean;
}

// Never touches an already-migrated app_metadata.role, so a role set by hand
// (including a future "editor") survives the backfill.
function planFor(user: User): Plan {
  const current = (user.app_metadata as { role?: string } | undefined)?.role;
  const legacy = (user.user_metadata as { role?: string } | undefined)?.role;
  return {
    appRole: current ? undefined : legacy === "admin" ? "admin" : "member",
    clearLegacy: legacy != null,
  };
}

async function main(): Promise<void> {
  const dryRun = parseDryRun(process.argv.slice(2));
  const admin = createSupabaseAdminClient();

  console.log(`Supabase:  ${process.env.SUPABASE_URL}`);
  console.log(`Dry run:   ${dryRun ? "YES (no writes)" : "no"}\n`);

  if (!dryRun && !(await confirm("Proceed with writes? [y/N] "))) {
    console.log("Aborted.");
    process.exit(0);
  }

  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  const failures: Array<{ id: string; error: string }> = [];

  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE });
    if (error) {
      console.error(`listUsers page ${page} failed: ${error.message}`);
      process.exit(1);
    }

    for (const user of data.users) {
      scanned++;
      const { appRole, clearLegacy } = planFor(user);
      if (!appRole && !clearLegacy) {
        skipped++;
        continue;
      }

      if (dryRun) {
        updated++;
        console.log(
          `would update ${user.id}: ${appRole ? `app_metadata.role=${appRole} ` : ""}${clearLegacy ? "clear user_metadata.role" : ""}`.trim(),
        );
        continue;
      }

      const payload: { app_metadata?: Record<string, unknown>; user_metadata?: Record<string, unknown> } = {};
      if (appRole) payload.app_metadata = { ...(user.app_metadata ?? {}), role: appRole };
      // null deletes the key under GoTrue merge semantics; harmless otherwise.
      if (clearLegacy) payload.user_metadata = { ...(user.user_metadata ?? {}), role: null };

      const { error: updErr } = await admin.auth.admin.updateUserById(user.id, payload);
      if (updErr) {
        failures.push({ id: user.id, error: updErr.message });
        console.error(`  ! ${user.id}: ${updErr.message}`);
      } else {
        updated++;
      }
    }

    if (data.users.length < PER_PAGE) break;
  }

  console.log(
    `\nDone: scanned=${scanned} ${dryRun ? "would update" : "updated"}=${updated} skipped=${skipped} failures=${failures.length}`,
  );
  process.exit(failures.length > 0 ? 1 : 0);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Fatal:", err instanceof Error ? `${err.message}\n${err.stack}` : err);
    process.exit(1);
  });
}
