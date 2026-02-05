import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import dotenv from 'dotenv';

dotenv.config();

const isTest = process.env.NODE_ENV === 'test';
const isProduction = process.env.NODE_ENV === 'production';

// Use test database URL if in test mode, otherwise use main database
const databaseUrl = isTest
  ? process.env.DATABASE_URL_TEST
  : process.env.DATABASE_URL;

if (!databaseUrl) {
  const envVar = isTest ? 'DATABASE_URL_TEST' : 'DATABASE_URL';
  throw new Error(`Missing ${envVar} environment variable`);
}

// Create postgres client with proper connection pool settings
const client = postgres(databaseUrl, {
  // Connection pool size
  // - Production: 10 connections (Supabase free tier allows 60)
  // - Development/Test: 5 connections
  max: isProduction ? 10 : 5,

  // Close idle connections after 20 seconds
  idle_timeout: 20,

  // Connection timeout after 10 seconds
  connect_timeout: 10,

  // SSL configuration (required for Supabase pooler)
  // Only disable SSL for local test databases
  ssl: isTest ? false : 'require',

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

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Re-export schema for convenience
export * from './schema';
