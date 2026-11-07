import { EventNominee } from "../../types";
import { formatNominee } from "./utils";

interface WinnerCellProps {
  winners: EventNominee[];
  displayMode: "movie_first" | "person_first";
}

const WinnerCell = ({ winners, displayMode }: WinnerCellProps) => (
  <div
    role="cell"
    className="flex items-center justify-center text-center px-2 py-2 md:px-3 min-h-[56px]"
  >
    {winners.length > 0 ? (
      <div className="flex flex-col gap-2">
        {winners.map((winner) => {
          const { primary, secondary } = formatNominee(winner, displayMode);

          return (
            <div key={winner.id} className="inline-block px-2 py-1">
              <p
                className="type-award-cell text-letterboxd-text-primary mb-0"
              >
                {primary}
              </p>
              {secondary && (
                <p className="type-micro md:type-caption text-letterboxd-text-muted">
                  {secondary}
                </p>
              )}
            </div>
          );
        })}
      </div>
    ) : (
      <>
        <span aria-hidden="true" className="text-letterboxd-text-muted type-caption">
          &mdash;
        </span>
        <span className="sr-only">Not announced</span>
      </>
    )}
  </div>
);

export default WinnerCell;
