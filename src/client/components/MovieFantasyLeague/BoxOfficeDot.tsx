import { isBoxOfficeEligible } from "../../utilities";

/**
 * Green when a film can still earn box-office points, red when it released too
 * early. Nothing renders for an unknown release date, where eligibility is not
 * decided yet.
 *
 * The label is the only non-colour carrier here — the /mfl table pairs these
 * with a legend, the picker does not.
 */
export function BoxOfficeDot({ releaseDate }: { releaseDate: string | null }) {
  if (releaseDate === null) return null;

  const eligible = isBoxOfficeEligible(releaseDate);

  return (
    <span
      role="img"
      aria-label={
        eligible
          ? "eligible for box office points"
          : "not eligible for box office points"
      }
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${
        eligible ? "bg-letterboxd-accent" : "bg-letterboxd-error-surface"
      }`}
    />
  );
}
