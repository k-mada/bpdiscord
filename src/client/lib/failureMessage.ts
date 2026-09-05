import { ApiError } from "./apiError";

/**
 * What to show a user for a failed request. A 4xx body is written to be read; a
 * 5xx body is the database's own message, so it never reaches the screen.
 */
export function failureMessage(error: unknown): string {
  if (error instanceof ApiError && error.status < 500) return error.message;
  return "Something went wrong. Please try again.";
}
