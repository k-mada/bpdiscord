import { ApiError } from "./apiError";

/**
 * What to show a user for a failed request.
 *
 * A 4xx body is written to be read — a duplicate-pick 409 names the film, a
 * validation 400 names the field. A 5xx body is the database's own message,
 * constraint names and all, so it never reaches the screen.
 */
export function failureMessage(error: unknown): string {
  if (error instanceof ApiError && error.status < 500) return error.message;
  return "Something went wrong. Please try again.";
}
