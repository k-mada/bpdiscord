import { EventNominee } from "../../types";

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
