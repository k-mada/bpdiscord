import { OscarsPrediction } from "../../types";

interface PickCellProps {
  pick: OscarsPrediction;
  isWinner: boolean;
  isCorrectPick: boolean;
}

const PickCell = ({ pick, isWinner, isCorrectPick }: PickCellProps) => (
  <div
    role="cell"
    className="flex items-center justify-center text-center px-2 py-2 md:px-3 min-h-[56px]"
  >
    <div
      className={`inline-block px-2 py-1 rounded ${
        isWinner ? "ring-2 ring-letterboxd-pro bg-letterboxd-pro/10" : ""
      }`}
    >
      <p
        className="text-base md:text-lg font-semibold text-letterboxd-text-primary leading-snug mb-0"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        {isCorrectPick && (
          <>
            <span aria-hidden="true" className="mr-1">
              &#127942;
            </span>
            <span className="sr-only">Correct pick. </span>
          </>
        )}
        {pick.title}
        {isWinner && <span className="sr-only">. Won this category</span>}
      </p>
      {pick.subtitle && (
        <p className="text-[10px] md:text-xs text-letterboxd-text-muted">
          {pick.subtitle}
        </p>
      )}
    </div>
  </div>
);

export default PickCell;
