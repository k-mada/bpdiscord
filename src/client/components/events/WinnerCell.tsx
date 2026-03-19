import { EventNominee } from "../../types";

interface WinnerCellProps {
  winners: EventNominee[];
  displayMode: "movie_first" | "person_first";
}

const WinnerCell = ({ winners, displayMode }: WinnerCellProps) => (
  <div className="flex items-center justify-center text-center px-2 py-2 md:px-3">
    {winners.length > 0 ? (
      <div className="flex flex-col gap-2">
        {winners.map((winner) => {
          const primary =
            displayMode === "person_first" && winner.personName
              ? winner.personName
              : winner.movieOrShowName;
          const secondary =
            displayMode === "person_first"
              ? winner.movieOrShowName
              : winner.personName;

          return (
            <div key={winner.id} className="inline-block px-2 py-1">
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
          );
        })}
      </div>
    ) : (
      <span className="text-letterboxd-text-muted text-xs">&mdash;</span>
    )}
  </div>
);

export default WinnerCell;
