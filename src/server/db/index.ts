import "../loadEnv";

import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const isTest = process.env.NODE_ENV === "test";
const isProduction = process.env.NODE_ENV === "production";

// Use test database URL if in test mode, otherwise use main database
const databaseUrl = isTest
  ? process.env.DATABASE_URL_TEST
  : process.env.DATABASE_URL;

if (!databaseUrl) {
  const envVar = isTest ? "DATABASE_URL_TEST" : "DATABASE_URL";
  throw new Error(`Missing ${envVar} environment variable`);
}

// Local Postgres (Supabase started via `supabase start` or any 127.0.0.1
// / localhost / docker-internal host) doesn't speak TLS. The hosted
// Supabase pooler does and requires it. Detect by URL so the test path
// and the local-smoke path don't need to remember to flip NODE_ENV.
const isLocalDatabase =
  /(?:^|@)(127\.0\.0\.1|localhost|host\.docker\.internal)(?::|\/)/.test(
    databaseUrl,
  );

// Create postgres client with proper connection pool settings
const client = postgres(databaseUrl, {
  // Pool size. Prod is capped at 10 because Vercel runs many concurrent
  // lambdas, each with its own pool against the shared pooler. Dev is one
  // long-lived process, so give it headroom for the homepage's ~7-endpoint
  // fan-out instead of the old 5.
  max: isProduction ? 10 : 15,

  // Close idle connections after 20 seconds
  idle_timeout: 20,

  // Connection timeout after 10 seconds
  connect_timeout: 10,

  // SSL: required by hosted Supabase, unavailable on the local stack.
  ssl: isTest || isLocalDatabase ? false : "require",

  // Prepare statements for better performance
  prepare: true,
});

// Export drizzle instance with schema for relational queries
export const db = drizzle(client, { schema });

// Export client for test cleanup
export const dbClient = client;

// Graceful shutdown handler
const shutdown = async () => {
  await client.end();
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

// Re-export schema for convenience
export * from "./schema";
