import { EventNominee } from "../../types";

interface NomineeCellProps {
  nominee: EventNominee;
  displayMode: "movie_first" | "person_first";
  isWinner?: boolean;
}

const NomineeCell = ({ nominee, displayMode, isWinner }: NomineeCellProps) => {
  const primary =
    displayMode === "person_first" && nominee.personName
      ? nominee.personName
      : nominee.movieOrShowName;
  const secondary =
    displayMode === "person_first"
      ? nominee.movieOrShowName
      : nominee.personName;

  return (
    <div className="flex items-center justify-center text-center px-2 py-2 md:px-3">
      <div
        className={`inline-block px-2 py-1 rounded ${
          isWinner ? "ring-2 ring-letterboxd-pro bg-letterboxd-pro/10" : ""
        }`}
      >
        <p
          className="text-base md:text-lg font-semibold text-letterboxd-text-primary leading-snug mb-0"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {primary}
        </p>
        {secondary && (
          <p className="text-[10px] md:text-xs text-letterboxd-text-muted">
            {secondary}
          </p>
        )}
      </div>
    </div>
  );
};

export default NomineeCell;
