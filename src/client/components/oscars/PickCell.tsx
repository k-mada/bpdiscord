import { OscarsPrediction } from "../../types";

interface PickCellProps {
  pick: OscarsPrediction;
  isWinner: boolean;
  isCorrectPick: boolean;
}

const PickCell = ({ pick, isWinner, isCorrectPick }: PickCellProps) => (
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
        {/* {isCorrectPick && <span className="mr-1">🏆</span>} */}
        {pick.title}
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
