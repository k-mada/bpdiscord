/**
 * Row validation for the MFLFilms bulk upload. Pure, so the dryRun preview and
 * the commit cannot disagree about what is valid.
 */

export const MAX_IMPORT_ROWS = 1000;

// Mirrors validateFilmSlug in middleware/validation.
const FILM_SLUG = /^[a-z0-9._-]{1,200}$/;

// Excel emits 1/5/2026 as readily as 01/05/2026.
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
export interface ValidRow {
  row: number;
  filmSlug: string;
}

export interface InvalidRow {
  row: number;
  filmSlug: string;
  reasons: string[];
}

export interface ImportVerdict {
  valid: ValidRow[];
  invalid: InvalidRow[];
  films: ValidFilm[];
}

type Cell = { readable: true; text: string } | { readable: false };

/**
 * Absent, null and blank mean "empty cell". Anything unreadable is reported
 * rather than coerced to NULL, which would lose data on a client bug.
 */
function readCell(value: unknown): Cell {
  if (value === undefined || value === null) return { readable: true, text: "" };
  if (typeof value === "string") return { readable: true, text: value.trim() };
  if (typeof value === "number" && Number.isFinite(value)) {
    return { readable: true, text: String(value) };
  }
  return { readable: false };
}

/**
 * mm/dd/yyyy to the YYYY-MM-DD a Postgres `date` takes. Null when it is not a
 * real calendar date — 02/30/2026 matches the shape but fails the round-trip.
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

function parsePrice(text: string): { ok: true; value: number | null } | { ok: false } {
  if (text === "") return { ok: true, value: null };
  if (!/^\d+$/.test(text)) return { ok: false };
  const price = Number(text);
  return Number.isSafeInteger(price) ? { ok: true, value: price } : { ok: false };
}

/**
 * film_slug is a case-sensitive key MFLUserPicks references, so a mis-cased row
 * would otherwise open a second catalogue entry no pick can reach.
 */
function normaliseSlug(text: string): string {
  return text.toLowerCase();
}

/**
 * Reports all of a row's problems at once, so fixing the file is one pass.
 * `films` is populated only when `invalid` is empty — all rows or none.
 */
export function validateFilmRows(rows: FilmImportRow[]): ImportVerdict {
  const slugRows = new Map<string, number[]>();
  rows.forEach((row, index) => {
    const cell = readCell(row?.film_slug);
    if (!cell.readable || cell.text === "") return;
    const slug = normaliseSlug(cell.text);
    const seen = slugRows.get(slug);
    if (seen) seen.push(index + 1);
    else slugRows.set(slug, [index + 1]);
  });

  const valid: ValidRow[] = [];
  const invalid: InvalidRow[] = [];
  const films: ValidFilm[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 1;
    const reasons: string[] = [];

    const slugCell = readCell(row?.film_slug);
    let filmSlug = "";
    if (!slugCell.readable) {
      reasons.push("film_slug must be text");
    } else if (slugCell.text === "") {
      reasons.push("film_slug is required");
    } else {
      filmSlug = normaliseSlug(slugCell.text);
      if (!FILM_SLUG.test(filmSlug)) {
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
    }

    const titleCell = readCell(row?.title);
    let title = "";
    if (!titleCell.readable) {
      reasons.push("title must be text");
    } else if (titleCell.text === "") {
      reasons.push("title is required");
    } else {
      title = titleCell.text;
    }

    const dateCell = readCell(row?.release_date);
    let releaseDate: string | null = null;
    if (!dateCell.readable) {
      reasons.push("release_date must be text");
    } else if (dateCell.text !== "") {
      releaseDate = parseUsDate(dateCell.text);
      if (releaseDate === null) {
        reasons.push(`release_date '${dateCell.text}' is not a mm/dd/yyyy date`);
      }
    }

    const priceCell = readCell(row?.price);
    let price: number | null = null;
    if (!priceCell.readable) {
      reasons.push("price must be a number");
    } else {
      const parsed = parsePrice(priceCell.text);
      if (!parsed.ok) {
        reasons.push(`price '${priceCell.text}' is not a non-negative integer`);
      } else {
        price = parsed.value;
      }
    }

    if (reasons.length > 0) {
      invalid.push({ row: rowNumber, filmSlug, reasons });
      return;
    }

    valid.push({ row: rowNumber, filmSlug });
    films.push({ filmSlug, title, releaseDate, price });
  });

  return {
    valid,
    invalid,
    films: invalid.length > 0 ? [] : films,
  };
}
