/**
 * Error carrying the HTTP status of a failed API response so callers can tell
 * a genuine auth rejection (401/403) apart from a network or 5xx blip. Lives in
 * its own module (not services/api) so it survives a `vi.mock` of the api layer
 * and stays importable by both the thrower and the consumers.
 */
export class ApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}
