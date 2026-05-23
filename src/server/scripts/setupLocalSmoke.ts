/**
 * One-shot local-smoke bootstrap.
 *
 *   yarn setup:local
 *
 * Idempotent. Safe to re-run. Will refuse to touch anything if Supabase
 * isn't pointed at the local instance.
 *
 * What it does:
 *   1. Reads `supabase status -o env` to get the local Supabase keys.
 *   2. Writes src/server/.env.local and src/client/.env.local from the
 *      *.local.example templates with the real keys filled in. Skips
 *      files that already exist unless --force.
 *   3. Connects to the LOCAL Supabase (refuses to run if the URL isn't
 *      127.0.0.1 / localhost) and seeds a known admin user via the
 *      service-role key.
 *
 * Default admin credentials (override via --email / --password flags):
 *   email:    admin@local.test
 *   password: dev-admin-pw
 *
 * The seeded user gets user_metadata.role = "admin" and an app_users
 * row so /admin/users + admin-gated routes work end-to-end.
 */

import { execSync } from "child_process";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

import { createClient, SupabaseClient } from "@supabase/supabase-js";

import {
  FIXTURE_FILMS,
  FIXTURE_USERS,
  FIXTURE_USER_FILMS,
} from "./fixtures/localSmokeData";

interface CliFlags {
  force: boolean;
  email: string;
  password: string;
  name: string;
  lbusername: string | null;
  withFixtures: boolean;
}

const DEFAULT_EMAIL = "admin@local.test";
const DEFAULT_PASSWORD = "dev-admin-pw";
const DEFAULT_NAME = "Local Admin";

function parseFlags(argv: string[]): CliFlags {
  const flags: CliFlags = {
    force: false,
    email: DEFAULT_EMAIL,
    password: DEFAULT_PASSWORD,
    name: DEFAULT_NAME,
    lbusername: null,
    withFixtures: true,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--force") flags.force = true;
    else if (a === "--email") flags.email = argv[++i]!;
    else if (a === "--password") flags.password = argv[++i]!;
    else if (a === "--name") flags.name = argv[++i]!;
    else if (a === "--lbusername") flags.lbusername = argv[++i]!;
    else if (a === "--no-fixtures") flags.withFixtures = false;
    else if (a === "--help" || a === "-h") {
      console.log(
        `\nUsage: yarn setup:local [options]\n\nOptions:\n  --force            Overwrite existing .env.local files\n  --email <addr>     Admin email (default: ${DEFAULT_EMAIL})\n  --password <pw>    Admin password (default: ${DEFAULT_PASSWORD})\n  --name <str>       Admin display name (default: "${DEFAULT_NAME}")\n  --lbusername <s>   Optional Letterboxd username to link to the admin\n  --no-fixtures      Skip seeding fixture Users/Films/UserFilms\n  --help, -h         Show this message\n`,
      );
      process.exit(0);
    }
  }
  return flags;
}

interface SupabaseStatusEnv {
  API_URL: string;
  ANON_KEY: string;
  SERVICE_ROLE_KEY: string;
  DB_URL: string;
  JWT_SECRET: string;
}

function readSupabaseStatus(): SupabaseStatusEnv {
  let raw: string;
  try {
    raw = execSync("supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    console.error(
      "\n✗ `supabase status -o env` failed. Run `supabase start` first to bring up the local Supabase stack.\n",
    );
    if (e instanceof Error) console.error(e.message);
    process.exit(1);
  }

  const parsed: Partial<SupabaseStatusEnv> = {};
  for (const line of raw.split("\n")) {
    const m = line.match(/^([A-Z_]+)="(.*)"$/);
    if (!m) continue;
    const key = m[1] as keyof SupabaseStatusEnv;
    parsed[key] = m[2]!;
  }

  const required: Array<keyof SupabaseStatusEnv> = [
    "API_URL",
    "ANON_KEY",
    "SERVICE_ROLE_KEY",
    "DB_URL",
    "JWT_SECRET",
  ];
  const missing = required.filter((k) => !parsed[k]);
  if (missing.length > 0) {
    console.error(
      `\n✗ supabase status didn't expose: ${missing.join(", ")}. Is the local stack actually up?\n`,
    );
    process.exit(1);
  }

  return parsed as SupabaseStatusEnv;
}

function templateAndWrite(
  templatePath: string,
  outPath: string,
  replacements: Record<string, string>,
  force: boolean,
): "wrote" | "skipped" {
  if (existsSync(outPath) && !force) {
    return "skipped";
  }
  const template = readFileSync(templatePath, "utf8");
  let out = template;
  for (const [key, value] of Object.entries(replacements)) {
    out = out.split(key).join(value);
  }
  writeFileSync(outPath, out);
  return "wrote";
}

function writeEnvFiles(env: SupabaseStatusEnv, force: boolean): void {
  const projectRoot = resolve(__dirname, "..", "..", "..");
  const serverDir = resolve(projectRoot, "src", "server");
  const clientDir = resolve(projectRoot, "src", "client");

  const serverTpl = resolve(serverDir, ".env.local.example");
  const serverOut = resolve(serverDir, ".env.local");
  const clientTpl = resolve(clientDir, ".env.local.example");
  const clientOut = resolve(clientDir, ".env.local");

  // Templates use the literal string __from_supabase_status__ as a
  // placeholder. We need a per-line replacement so the right key lands
  // on the right line — replace ANON_KEY first, then SERVICE_ROLE_KEY.
  // The simplest robust way: do line-level substitutions.
  const serverContent = readFileSync(serverTpl, "utf8")
    .replace(
      /^SUPABASE_ANON_KEY=.*$/m,
      `SUPABASE_ANON_KEY=${env.ANON_KEY}`,
    )
    .replace(
      /^SUPABASE_SERVICE_ROLE_KEY=.*$/m,
      `SUPABASE_SERVICE_ROLE_KEY=${env.SERVICE_ROLE_KEY}`,
    )
    .replace(/^SUPABASE_URL=.*$/m, `SUPABASE_URL=${env.API_URL}`)
    .replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${env.DB_URL}`)
    .replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${env.JWT_SECRET}`);

  const clientContent = readFileSync(clientTpl, "utf8")
    .replace(/^VITE_SUPABASE_URL=.*$/m, `VITE_SUPABASE_URL=${env.API_URL}`)
    .replace(
      /^VITE_SUPABASE_ANON_KEY=.*$/m,
      `VITE_SUPABASE_ANON_KEY=${env.ANON_KEY}`,
    );

  const serverStatus =
    existsSync(serverOut) && !force
      ? "skipped"
      : (writeFileSync(serverOut, serverContent), "wrote");
  console.log(
    `  ${serverStatus === "wrote" ? "✓" : "·"} src/server/.env.local — ${serverStatus}`,
  );

  const clientStatus =
    existsSync(clientOut) && !force
      ? "skipped"
      : (writeFileSync(clientOut, clientContent), "wrote");
  console.log(
    `  ${clientStatus === "wrote" ? "✓" : "·"} src/client/.env.local — ${clientStatus}`,
  );

  if ((serverStatus === "skipped" || clientStatus === "skipped") && !force) {
    console.log(
      "    (re-run with --force to overwrite existing .env.local files)",
    );
  }
  // Suppress unused-var lint after the IIFE-style writeFileSync trick above.
  void templateAndWrite;
}

async function seedAdmin(
  env: SupabaseStatusEnv,
  flags: CliFlags,
): Promise<void> {
  if (
    !env.API_URL.includes("127.0.0.1") &&
    !env.API_URL.includes("localhost")
  ) {
    console.error(
      `\n✗ Refusing to seed admin against non-local Supabase: ${env.API_URL}\n  This script is local-smoke only. Use the Supabase dashboard for prod.\n`,
    );
    process.exit(1);
  }

  const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // Idempotency: list and look for a matching email. Supabase's
  // listUsers is paginated; the local instance has tiny page counts, so
  // a single call covers the realistic case.
  const { data: list, error: listErr } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listErr) {
    console.error(`✗ listUsers failed: ${listErr.message}`);
    process.exit(1);
  }

  const existing = list.users.find((u) => u.email === flags.email);
  let authUserId: string;

  if (existing) {
    // Update metadata in place so re-running this script with a different
    // --name picks up the new value, and ensures role:admin sticks.
    const { error: updErr } = await admin.auth.admin.updateUserById(
      existing.id,
      {
        user_metadata: {
          ...(existing.user_metadata ?? {}),
          name: flags.name,
          role: "admin",
        },
        password: flags.password,
      },
    );
    if (updErr) {
      console.error(`✗ updateUserById failed: ${updErr.message}`);
      process.exit(1);
    }
    authUserId = existing.id;
    console.log(`  · admin auth user (existing) — ${flags.email}`);
  } else {
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email: flags.email,
        password: flags.password,
        email_confirm: true,
        user_metadata: { name: flags.name, role: "admin" },
      });
    if (createErr || !created?.user) {
      console.error(
        `✗ createUser failed: ${createErr?.message ?? "unknown"}`,
      );
      process.exit(1);
    }
    authUserId = created.user.id;
    console.log(`  ✓ admin auth user (created) — ${flags.email}`);
  }

  // Upsert the app_users row. The schema FK to auth.users(id) means we
  // can't insert without an existing auth row — which we just confirmed.
  const { error: upsertErr } = await admin
    .from("app_users")
    .upsert(
      {
        id: authUserId,
        lbusername: flags.lbusername,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    );
  if (upsertErr) {
    console.error(`✗ app_users upsert failed: ${upsertErr.message}`);
    process.exit(1);
  }
  console.log(
    `  ✓ app_users row${flags.lbusername ? ` (linked to ${flags.lbusername})` : ""}`,
  );

  if (flags.lbusername) {
    // Best-effort: ensure the linked lbusername exists in Users so JOINs
    // don't return null displayName. We don't touch it if it's already
    // there.
    const { error: usersErr } = await admin
      .from("Users")
      .upsert(
        { lbusername: flags.lbusername, is_discord: true },
        { onConflict: "lbusername", ignoreDuplicates: true },
      );
    if (usersErr) {
      console.log(
        `    · Users stub upsert non-fatal warning: ${usersErr.message}`,
      );
    }
  }
}

/**
 * Seed Letterboxd-side fixtures (Users + Films + UserFilms) so the homepage
 * stats / comparison / hater rankings pages have content to render. Idempotent
 * via ON CONFLICT DO UPDATE on every table's natural key.
 *
 * "Highest rated movies (20+ ratings)" stays empty by design — that threshold
 * would require ≥20 users, which is more fixture noise than it's worth.
 * Documented in CLAUDE.md.
 */
async function seedFixtures(admin: SupabaseClient): Promise<void> {
  const usersPayload = FIXTURE_USERS.map((u) => ({
    lbusername: u.lbusername,
    display_name: u.display_name,
    followers: u.followers,
    following: u.following,
    number_of_lists: u.number_of_lists,
    is_discord: true,
    updated_at: new Date().toISOString(),
  }));
  const { error: usersErr } = await admin
    .from("Users")
    .upsert(usersPayload, { onConflict: "lbusername" });
  if (usersErr) {
    console.error(`✗ Users upsert failed: ${usersErr.message}`);
    process.exit(1);
  }
  console.log(`  ✓ Users (${FIXTURE_USERS.length} rows)`);

  const filmsPayload = FIXTURE_FILMS.map((f) => ({
    film_slug: f.film_slug,
    title: f.title,
    lb_rating: f.lb_rating,
    poster: f.poster,
    updated_at: new Date().toISOString(),
  }));
  const { error: filmsErr } = await admin
    .from("Films")
    .upsert(filmsPayload, { onConflict: "film_slug" });
  if (filmsErr) {
    console.error(`✗ Films upsert failed: ${filmsErr.message}`);
    process.exit(1);
  }
  console.log(`  ✓ Films (${FIXTURE_FILMS.length} rows)`);

  const userFilmsPayload = FIXTURE_USER_FILMS.map((uf) => ({
    lbusername: uf.lbusername,
    film_slug: uf.film_slug,
    title: uf.title,
    rating: uf.rating,
    liked: uf.liked,
    updated_at: new Date().toISOString(),
  }));
  const { error: ufErr } = await admin
    .from("UserFilms")
    .upsert(userFilmsPayload, { onConflict: "lbusername,film_slug" });
  if (ufErr) {
    console.error(`✗ UserFilms upsert failed: ${ufErr.message}`);
    process.exit(1);
  }
  console.log(`  ✓ UserFilms (${FIXTURE_USER_FILMS.length} rows)`);
}

async function main() {
  const flags = parseFlags(process.argv.slice(2));

  console.log("→ Reading local Supabase status…");
  const env = readSupabaseStatus();
  console.log(`  ✓ ${env.API_URL}`);

  console.log("\n→ Writing .env.local files…");
  writeEnvFiles(env, flags.force);

  console.log("\n→ Seeding admin user…");
  await seedAdmin(env, flags);

  if (flags.withFixtures) {
    console.log("\n→ Seeding fixtures (Discord users + films)…");
    const admin = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    await seedFixtures(admin);
  } else {
    console.log("\n· Skipping fixtures (--no-fixtures)");
  }

  console.log(`\n✅ Local smoke ready.\n`);
  console.log(`Next:`);
  console.log(`  yarn dev:local`);
  console.log(`Then log in at http://localhost:5173/login`);
  console.log(`  email:    ${flags.email}`);
  console.log(`  password: ${flags.password}`);
  console.log(``);
}

main().catch((e) => {
  console.error("✗ setup:local failed:", e);
  process.exit(1);
});
