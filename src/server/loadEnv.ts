/**
 * Centralized .env loader. Imported once by server.ts and any standalone
 * script (seed, setup) that runs outside the main server entry.
 *
 * `yarn dev` defaults to **prod** — loads only `src/server/.env`. Smoke
 * mode is **explicit opt-in** via the `SMOKE_LOCAL=1` env var (set by
 * `yarn dev:local`), which loads `src/server/.env.smoke` FIRST so its
 * values override `.env`. dotenv's no-override semantics mean the first
 * file to define a variable wins.
 *
 * File presence alone never switches the mode — that would risk silently
 * pointing dev at the local stack after running `yarn setup:local` once.
 */

import { existsSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";

const serverDir = resolve(__dirname);
const smokePath = resolve(serverDir, ".env.smoke");
const mainPath = resolve(serverDir, ".env");

const smokeRequested = process.env.SMOKE_LOCAL === "1";
const smokeFileExists = existsSync(smokePath);
const smokeLoaded = smokeRequested && smokeFileExists;

if (smokeLoaded) {
  dotenv.config({ path: smokePath });
}
dotenv.config({ path: mainPath });

// One-line breadcrumb at startup so it's obvious which mode the server
// booted in. Suppressed under NODE_ENV=test to avoid spamming vitest.
if (process.env.NODE_ENV !== "test") {
  const target = process.env.SUPABASE_URL ?? "(SUPABASE_URL unset)";
  const isLocal = target.includes("127.0.0.1") || target.includes("localhost");
  let label: string;
  if (smokeLoaded) label = ".env.smoke + .env";
  else if (smokeRequested && !smokeFileExists)
    label = ".env only (SMOKE_LOCAL=1 set but .env.smoke missing — run `yarn setup:local`)";
  else label = ".env only";
  console.log(
    `[env] ${label} → ${isLocal ? "LOCAL" : "REMOTE"} ${target}`,
  );
}
