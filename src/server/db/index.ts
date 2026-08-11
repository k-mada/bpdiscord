import "../loadEnv";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const isTest = process.env.NODE_ENV === "test";
const isProduction = process.env.NODE_ENV === "production";

const databaseUrl = isTest
  ? process.env.DATABASE_URL_TEST
  : process.env.DATABASE_URL;

if (!databaseUrl) {
  const envVar = isTest ? "DATABASE_URL_TEST" : "DATABASE_URL";
  throw new Error(`Missing ${envVar} environment variable`);
}

// Local Postgres doesn't speak TLS; the hosted pooler requires it. Detect by
// URL so the test and local-smoke paths don't have to flip NODE_ENV.
const isLocalDatabase =
  /(?:^|@)(127\.0\.0\.1|localhost|host\.docker\.internal)(?::|\/)/.test(
    databaseUrl,
  );

const client = postgres(databaseUrl, {
  // Prod is capped low because each Vercel lambda holds its own pool against
  // the shared pooler; dev is one process and needs fan-out headroom.
  max: isProduction ? 10 : 15,

  idle_timeout: 20,
  connect_timeout: 10,

  // SSL: required by hosted Supabase, unavailable on the local stack.
  ssl: isTest || isLocalDatabase ? false : "require",

  // Prepare statements for better performance
  prepare: true,
});

export const db = drizzle(client, { schema });

export const dbClient = client;

// Graceful shutdown handler
const shutdown = async () => {
  await client.end();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Re-export schema for convenience
export * from "./schema";
