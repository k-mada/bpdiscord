/**
 * Asserts the rejection REASONS, not just the count — a preview that cannot say
 * why is one nobody can act on.
 *
 * Run with: yarn test
 */

import { describe, it, expect } from "vitest";
import { validateFilmRows, parseUsDate } from "../controllers/mflFilmImport";

const anora = {
  title: "Anora",
  film_slug: "anora",
  release_date: "10/18/2026",
  price: "40",
};

describe("parseUsDate", () => {
  it("converts mm/dd/yyyy to the Postgres date form", () => {
    expect(parseUsDate("10/18/2026")).toBe("2026-10-18");
  });

  it("accepts the single-digit month and day Excel writes", () => {
    expect(parseUsDate("1/5/2026")).toBe("2026-01-05");
  });

  it("rejects a date that matches the shape but is not on the calendar", () => {
    expect(parseUsDate("02/30/2026")).toBeNull();
    expect(parseUsDate("13/01/2026")).toBeNull();
  });

  it("rejects other orderings and separators", () => {
    expect(parseUsDate("2026-10-18")).toBeNull();
    expect(parseUsDate("18.10.2026")).toBeNull();
    expect(parseUsDate("")).toBeNull();
  });

  it("keeps a leap day that exists and drops one that does not", () => {
    expect(parseUsDate("02/29/2024")).toBe("2024-02-29");
    expect(parseUsDate("02/29/2026")).toBeNull();
  });
});

describe("validateFilmRows", () => {
  it("accepts a well-formed row and normalises it for the DB", () => {
    const verdict = validateFilmRows([anora]);

    expect(verdict.invalid).toEqual([]);
    expect(verdict.valid).toEqual([{ row: 1, filmSlug: "anora" }]);
    expect(verdict.films).toEqual([
      {
        filmSlug: "anora",
        title: "Anora",
        releaseDate: "2026-10-18",
        price: 40,
      },
    ]);
  });

  it("numbers rows from 1 so the admin can find them in the file", () => {
    const verdict = validateFilmRows([anora, { ...anora, film_slug: "" }]);

    expect(verdict.invalid[0]?.row).toBe(2);
  });

  it("folds a mis-cased slug to lowercase rather than opening a second row", () => {
    const verdict = validateFilmRows([{ ...anora, film_slug: "Anora" }]);

    expect(verdict.invalid).toEqual([]);
    expect(verdict.films[0]?.filmSlug).toBe("anora");
    expect(verdict.valid[0]?.filmSlug).toBe("anora");
  });

  it("catches a duplicate that only differs by case", () => {
    const verdict = validateFilmRows([anora, { ...anora, film_slug: "ANORA" }]);

    expect(verdict.valid).toEqual([]);
    expect(verdict.invalid.map((r) => r.row)).toEqual([1, 2]);
    expect(verdict.invalid[0]?.reasons[0]).toContain("also row 2");
  });

  it.each([
    ["price", { ...anora, price: {} }, "price must be a number"],
    ["price as a boolean", { ...anora, price: true }, "price must be a number"],
    ["price as an array", { ...anora, price: [] }, "price must be a number"],
    ["release_date", { ...anora, release_date: {} }, "release_date must be text"],
    ["title", { ...anora, title: {} }, "title must be text"],
    ["film_slug", { ...anora, film_slug: {} }, "film_slug must be text"],
  ])("rejects an unreadable %s instead of silently writing NULL", (_l, row, expected) => {
    const verdict = validateFilmRows([row]);

    expect(verdict.valid).toEqual([]);
    expect(verdict.invalid[0]?.reasons).toContain(expected);
    expect(verdict.films).toEqual([]);
  });

  it("treats an explicit null as a blank cell, not an unreadable one", () => {
    const verdict = validateFilmRows([
      { title: "Hamnet", film_slug: "hamnet", release_date: null, price: null },
    ]);

    expect(verdict.invalid).toEqual([]);
    expect(verdict.films[0]).toMatchObject({ releaseDate: null, price: null });
  });

  it("trims surrounding whitespace rather than rejecting on it", () => {
    const verdict = validateFilmRows([
      { title: "  Anora  ", film_slug: " anora ", release_date: " 10/18/2026 ", price: " 40 " },
    ]);

    expect(verdict.invalid).toEqual([]);
    expect(verdict.films[0]).toMatchObject({ filmSlug: "anora", title: "Anora" });
  });

  it("treats a blank release_date and price as NULL", () => {
    const verdict = validateFilmRows([
      { title: "Hamnet", film_slug: "hamnet", release_date: "", price: "" },
    ]);

    expect(verdict.invalid).toEqual([]);
    expect(verdict.films[0]).toEqual({
      filmSlug: "hamnet",
      title: "Hamnet",
      releaseDate: null,
      price: null,
    });
  });

  it("treats missing release_date and price keys as NULL", () => {
    const verdict = validateFilmRows([{ title: "Hamnet", film_slug: "hamnet" }]);

    expect(verdict.invalid).toEqual([]);
    expect(verdict.films[0]).toMatchObject({ releaseDate: null, price: null });
  });

  it("accepts a price of zero, which is not the same as blank", () => {
    const verdict = validateFilmRows([{ ...anora, price: "0" }]);

    expect(verdict.invalid).toEqual([]);
    expect(verdict.films[0]?.price).toBe(0);
  });

  it("accepts numbers as well as the strings a CSV parser yields", () => {
    const verdict = validateFilmRows([{ ...anora, price: 40 }]);

    expect(verdict.invalid).toEqual([]);
    expect(verdict.films[0]?.price).toBe(40);
  });

  it.each([
    ["a blank film_slug", { ...anora, film_slug: "  " }, "film_slug is required"],
    ["a missing title", { ...anora, title: "" }, "title is required"],
    ["a slug with illegal characters", { ...anora, film_slug: "an ora!" }, "film_slug may only"],
    ["an unparseable date", { ...anora, release_date: "13/45/2026" }, "is not a mm/dd/yyyy date"],
    ["a negative price", { ...anora, price: "-5" }, "is not a non-negative integer"],
    ["a fractional price", { ...anora, price: "4.5" }, "is not a non-negative integer"],
    ["a non-numeric price", { ...anora, price: "free" }, "is not a non-negative integer"],
  ])("rejects %s and says why", (_label, row, expected) => {
    const verdict = validateFilmRows([row]);

    expect(verdict.valid).toEqual([]);
    expect(verdict.invalid[0]?.reasons.join(" ")).toContain(expected);
  });

  it("reports every problem on a row at once", () => {
    const verdict = validateFilmRows([
      { title: "", film_slug: "", release_date: "nope", price: "-1" },
    ]);

    expect(verdict.invalid[0]?.reasons).toHaveLength(4);
  });

  it("rejects both halves of a duplicate slug, each naming the other", () => {
    const verdict = validateFilmRows([
      anora,
      { ...anora, price: "55" },
    ]);

    expect(verdict.valid).toEqual([]);
    expect(verdict.invalid.map((r) => r.row)).toEqual([1, 2]);
    expect(verdict.invalid[0]?.reasons[0]).toContain("also row 2");
    expect(verdict.invalid[1]?.reasons[0]).toContain("also row 1");
  });

  it("names all the others when a slug appears three times", () => {
    const verdict = validateFilmRows([anora, anora, anora]);

    expect(verdict.invalid).toHaveLength(3);
    expect(verdict.invalid[1]?.reasons[0]).toContain("also row 1, 3");
  });

  it("does not treat two blank slugs as duplicates of each other", () => {
    const verdict = validateFilmRows([
      { ...anora, film_slug: "" },
      { ...anora, film_slug: "" },
    ]);

    for (const row of verdict.invalid) {
      expect(row.reasons).toEqual(["film_slug is required"]);
    }
  });

  it("withholds every film when any single row is rejected", () => {
    const verdict = validateFilmRows([
      anora,
      { ...anora, film_slug: "hamnet", title: "" },
      { ...anora, film_slug: "sinners" },
    ]);

    expect(verdict.valid.map((a) => a.filmSlug)).toEqual(["anora", "sinners"]);
    expect(verdict.invalid).toHaveLength(1);
    // All-or-nothing: the caller must have nothing to write.
    expect(verdict.films).toEqual([]);
  });

  it("survives a row that is not an object", () => {
    const verdict = validateFilmRows([null as never, undefined as never]);

    expect(verdict.invalid).toHaveLength(2);
    expect(verdict.films).toEqual([]);
  });
});
