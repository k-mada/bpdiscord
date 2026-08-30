import { OscarsCategory, OscarsPrediction, OscarsViewMode } from "../../types";
import { STICKY_TOGGLE_HEIGHT } from "./constants";
import { isCorrectPick } from "./utils";
import { DesktopCategoryLabel } from "./CategoryLabel";
import PickCell from "./PickCell";
import WinnerCell from "./WinnerCell";

interface DesktopTableProps {
  categories: OscarsCategory[];
  getSeanPick: (cat: OscarsCategory) => OscarsPrediction;
  getAmandaPick: (cat: OscarsCategory) => OscarsPrediction;
  viewMode: OscarsViewMode;
  onCategoryTap: (cat: OscarsCategory) => void;
}

const HEADER_CELL =
  "px-3 py-2 text-sm font-semibold uppercase tracking-wider text-letterboxd-pro";

// Explicit roles, not a <table>: display:grid strips the implicit table
// semantics of native table elements in Chrome and Firefox.
const DesktopTable = ({
  categories,
  getSeanPick,
  getAmandaPick,
  viewMode,
  onCategoryTap,
}: DesktopTableProps) => (
  <div className="card" role="table" aria-label="Predictions by category">
    <div
      role="row"
      className={`grid grid-cols-[25%_1fr_1fr_1fr] sticky ${STICKY_TOGGLE_HEIGHT} z-10 bg-letterboxd-bg-secondary shadow-md border-b border-letterboxd-pro/30`}
    >
      <div role="columnheader" className={`${HEADER_CELL} text-left`}>
        Category
      </div>
      <div role="columnheader" className={`${HEADER_CELL} text-center`}>
        Sean
      </div>
      <div role="columnheader" className={`${HEADER_CELL} text-center`}>
        Amanda
      </div>
      <div role="columnheader" className={`${HEADER_CELL} text-center`}>
        Winner
      </div>
    </div>

    {categories.map((cat, i) => {
      const seanPick = getSeanPick(cat);
      const amandaPick = getAmandaPick(cat);
      return (
        <div
          key={cat.order}
          role="row"
          className={`grid grid-cols-[25%_1fr_1fr_1fr] items-center min-h-[72px] border-b border-letterboxd-border/50 ${
            i % 2 === 0 ? "bg-letterboxd-bg-secondary/30" : ""
          }`}
        >
          <div role="rowheader" className="px-3 py-2">
            <DesktopCategoryLabel category={cat} onTap={onCategoryTap} />
          </div>
          <PickCell
            pick={seanPick}
            isWinner={cat.winner === "sean" && viewMode === "will_win"}
            isCorrectPick={isCorrectPick(seanPick, cat)}
          />
          <PickCell
            pick={amandaPick}
            isWinner={cat.winner === "amanda" && viewMode === "will_win"}
            isCorrectPick={isCorrectPick(amandaPick, cat)}
          />
          <WinnerCell cat={cat} />
        </div>
      );
    })}
  </div>
);

export default DesktopTable;
