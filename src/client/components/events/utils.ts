import { EventNominee } from "../../types";

/**
 * Returns the ordinal suffix for a number (e.g., 1 → "st", 2 → "nd", 3 → "rd", 4 → "th")
 */
export function getOrdinalSuffix(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] ?? s[v] ?? "th";
}

/**
 * Formats a nominee's display text based on the category's display mode.
 * - person_first: person name is primary (e.g., acting categories)
 * - movie_first: movie/show name is primary (e.g., Best Picture, technical awards)
 */
export const formatNominee = (
  nominee: EventNominee,
  displayMode: "movie_first" | "person_first"
): { primary: string; secondary: string | null } => {
  const primary =
    displayMode === "person_first" && nominee.personName
      ? nominee.personName
      : nominee.movieOrShowName;
  const secondary =
    displayMode === "person_first"
      ? nominee.movieOrShowName
      : nominee.personName;
  return { primary, secondary };
};
