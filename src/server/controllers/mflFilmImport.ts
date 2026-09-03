/**
 * Row validation for the MFLFilms bulk upload.
 *
 * Pure and express-free so the same verdict backs both the dryRun preview and
 * the commit — the two cannot disagree about what is valid because they run
 * this exact function.
 */

export const MAX_IMPORT_ROWS = 1000;

// Matches validateFilmSlug in middleware/validation, deliberately permissive.
const FILM_SLUG = /^[A-Za-z0-9._-]{1,200}$/;

// Excel writes 1/5/2026 as readily as 01/05/2026, so both are accepted.
const US_DATE = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export interface FilmImportRow {
  title?: unknown;
  film_slug?: unknown;
  release_date?: unknown;
  price?: unknown;
}

export interface ValidFilm {
  filmSlug: string;
  title: string;
  releaseDate: string | null;
  price: number | null;
}

/** `row` is the 1-based index into the submitted array, not the CSV line. */
export interface AcceptedRow {
  row: number;
  filmSlug: string;
}

export interface RejectedRow {
  row: number;
  filmSlug: string;
  reasons: string[];
}

export interface ImportVerdict {
  accepted: AcceptedRow[];
  rejected: RejectedRow[];
  films: ValidFilm[];
}

function asTrimmedString(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

/**
 * Converts mm/dd/yyyy to the YYYY-MM-DD a Postgres `date` column takes.
 * Returns null when the text is not a real calendar date — 02/30/2026 fails
 * the round-trip even though it matches the shape.
 */
export function parseUsDate(text: string): string | null {
  const match = US_DATE.exec(text);
  if (!match) return null;

  const [, mm, dd, yyyy] = match;
  const month = Number(mm);
  const day = Number(dd);
  const year = Number(yyyy);

  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    return null;
  }
  return `${yyyy}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function parsePrice(text: string): number | null | undefined {
  if (text === "") return null;
  if (!/^\d+$/.test(text)) return undefined;
  const price = Number(text);
  return Number.isSafeInteger(price) ? price : undefined;
}

/**
 * Validates every row and reports all of a row's problems at once, so an admin
 * fixing the file makes one pass rather than one pass per defect.
 *
 * `films` is populated only when `rejected` is empty — the caller commits all
 * rows or none.
 */
export function validateFilmRows(rows: FilmImportRow[]): ImportVerdict {
  const slugRows = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const slug = asTrimmedString(row?.film_slug);
    if (slug === "") return;
    const seen = slugRows.get(slug);
    if (seen) seen.push(index + 1);
    else slugRows.set(slug, [index + 1]);
  });

  const accepted: AcceptedRow[] = [];
  const rejected: RejectedRow[] = [];
  const films: ValidFilm[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const reasons: string[] = [];

    const filmSlug = asTrimmedString(row?.film_slug);
    if (filmSlug === "") {
      reasons.push("film_slug is required");
    } else if (!FILM_SLUG.test(filmSlug)) {
      reasons.push(
        "film_slug may only contain letters, digits, dots, hyphens and underscores",
      );
    } else {
      const duplicates = (slugRows.get(filmSlug) ?? []).filter(
        (other) => other !== rowNumber,
      );
      if (duplicates.length > 0) {
        reasons.push(
          `duplicate film_slug '${filmSlug}' (also row ${duplicates.join(", ")})`,
        );
      }
    }

    const title = asTrimmedString(row?.title);
    if (title === "") reasons.push("title is required");

    const rawDate = asTrimmedString(row?.release_date);
    let releaseDate: string | null = null;
    if (rawDate !== "") {
      releaseDate = parseUsDate(rawDate);
      if (releaseDate === null) {
        reasons.push(`release_date '${rawDate}' is not a mm/dd/yyyy date`);
      }
    }

    const price = parsePrice(asTrimmedString(row?.price));
    if (price === undefined) {
      reasons.push(
        `price '${asTrimmedString(row?.price)}' is not a non-negative integer`,
      );
    }

    if (reasons.length > 0) {
      rejected.push({ row: rowNumber, filmSlug, reasons });
      return;
    }

    accepted.push({ row: rowNumber, filmSlug });
    films.push({ filmSlug, title, releaseDate, price: price ?? null });
  });

  return {
    accepted,
    rejected,
    films: rejected.length > 0 ? [] : films,
  };
}
