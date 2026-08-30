import { OscarsCategory, OscarsPrediction, OscarsViewMode } from "../../types";
import { STICKY_TOGGLE_HEIGHT } from "./constants";
import { isCorrectPick } from "./utils";
import { MobileCategoryLabel } from "./CategoryLabel";
import PickCell from "./PickCell";
import WinnerCell from "./WinnerCell";

interface MobileTableProps {
  categories: OscarsCategory[];
  getSeanPick: (cat: OscarsCategory) => OscarsPrediction;
  getAmandaPick: (cat: OscarsCategory) => OscarsPrediction;
  viewMode: OscarsViewMode;
  onCategoryTap: (cat: OscarsCategory) => void;
}

const HEADER_CELL =
  "px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-letterboxd-pro";

const MobileTable = ({
  categories,
  getSeanPick,
  getAmandaPick,
  viewMode,
  onCategoryTap,
}: MobileTableProps) => (
  <div className="space-y-1" role="table" aria-label="Predictions by category">
    <div
      role="row"
      className={`grid grid-cols-3 sticky ${STICKY_TOGGLE_HEIGHT} z-10 bg-letterboxd-bg-secondary shadow-md border-b border-letterboxd-pro/30 rounded-t-lg`}
    >
      {/* sr-only is position:absolute, so this consumes no grid track. It is
          here because each row leads with a category rowheader. */}
      <div role="columnheader" className="sr-only">
        Category
      </div>
      <div role="columnheader" className={HEADER_CELL}>
        Sean
      </div>
      <div role="columnheader" className={HEADER_CELL}>
        Amanda
      </div>
      <div role="columnheader" className={HEADER_CELL}>
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
          className={`grid grid-cols-3 border-b border-letterboxd-border/50 ${
            i % 2 === 0 ? "bg-letterboxd-bg-secondary/30" : ""
          }`}
        >
          <div role="rowheader" className="col-span-3 px-3 pt-3 pb-1 text-center">
            <MobileCategoryLabel category={cat} onTap={onCategoryTap} />
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

export default MobileTable;
