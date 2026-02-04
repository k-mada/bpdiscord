/**
 * Type definitions for raw SQL query results.
 * These types match the exact shape returned by PostgreSQL queries.
 *
 * Note: Index signatures are required for compatibility with Drizzle's execute<T>
 */

// Base interface with index signature for Drizzle compatibility
interface QueryRow {
  [key: string]: unknown;
}

// Result from get_hater_rankings RPC
export interface HaterRankingRow extends QueryRow {
  lbusername: string;
  display_name: string | null;
  films_rated: string; // PostgreSQL returns bigint as string
  differential: string; // PostgreSQL returns numeric as string
  normalized: string; // PostgreSQL returns numeric as string
}

// Result from get_missing_films RPC
export interface MissingFilmsRow extends QueryRow {
  film_slugs: string[] | null;
}

/**
 * Helper to safely convert PostgreSQL numeric/bigint strings to numbers
 */
export function toNumber(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return value;
  const parsed = Number(value);
  return isNaN(parsed) ? 0 : parsed;
}
