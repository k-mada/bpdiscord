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

const MobileTable = ({
  categories,
  getSeanPick,
  getAmandaPick,
  viewMode,
  onCategoryTap,
}: MobileTableProps) => (
  <div className="space-y-1">
    <div
      className={`grid grid-cols-3 sticky ${STICKY_TOGGLE_HEIGHT} z-10 bg-letterboxd-bg-secondary shadow-md border-b border-letterboxd-pro/30 rounded-t-lg`}
    >
      <div className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-letterboxd-pro">
        Sean
      </div>
      <div className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-letterboxd-pro">
        Amanda
      </div>
      <div className="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wider text-letterboxd-pro">
        Winner
      </div>
    </div>

    {categories.map((cat, i) => {
      const seanPick = getSeanPick(cat);
      const amandaPick = getAmandaPick(cat);
      return (
        <div
          key={cat.order}
          className={`border-b border-letterboxd-border/50 ${
            i % 2 === 0 ? "bg-letterboxd-bg-secondary/30" : ""
          }`}
        >
          <div className="px-3 pt-3 pb-1 text-center">
            <MobileCategoryLabel category={cat} onTap={onCategoryTap} />
          </div>
          <div className="grid grid-cols-3 min-h-[56px]">
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
        </div>
      );
    })}
  </div>
);

export default MobileTable;
