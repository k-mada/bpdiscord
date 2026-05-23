/**
 * Centralized .env loader. Imported once by server.ts and any standalone
 * script (seed, setup) that runs outside the main server entry.
 *
 * Loading order (highest priority first; dotenv's no-override semantics
 * mean the first file to define a variable wins):
 *
 *   1. src/server/.env.local  — gitignored. When present, overrides .env.
 *                                Used for local-smoke-test mode.
 *   2. src/server/.env        — gitignored. Primary config (prod/dev).
 *
 * Both files are loaded relative to src/server/ regardless of cwd, so a
 * seed script invoked from project root sees the same values as the
 * server itself.
 */

import { existsSync } from "fs";
import { resolve } from "path";
import dotenv from "dotenv";

const serverDir = resolve(__dirname);
const localPath = resolve(serverDir, ".env.local");
const mainPath = resolve(serverDir, ".env");

const usedLocal = existsSync(localPath);

if (usedLocal) {
  dotenv.config({ path: localPath });
}
dotenv.config({ path: mainPath });

// One-line breadcrumb at startup so it's obvious which mode the server
// booted in. Especially important after the local-smoke setup landed —
// it's easy to forget you still have an .env.local lying around.
// Suppressed under NODE_ENV=test to avoid spamming vitest output.
if (process.env.NODE_ENV !== "test") {
  const target = process.env.SUPABASE_URL ?? "(SUPABASE_URL unset)";
  const isLocal = target.includes("127.0.0.1") || target.includes("localhost");
  console.log(
    `[env] ${usedLocal ? ".env.local + .env" : ".env only"} → ${isLocal ? "LOCAL" : "REMOTE"} ${target}`,
  );
}
