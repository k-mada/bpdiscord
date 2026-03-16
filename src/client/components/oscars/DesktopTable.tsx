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
}

const DesktopTable = ({
  categories,
  getSeanPick,
  getAmandaPick,
  viewMode,
}: DesktopTableProps) => (
  <div className="card">
    <div
      className={`grid grid-cols-[25%_1fr_1fr_1fr] sticky ${STICKY_TOGGLE_HEIGHT} z-10 bg-letterboxd-bg-secondary shadow-md border-b border-letterboxd-pro/30`}
    >
      <div className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wider text-letterboxd-pro">
        Category
      </div>
      <div className="px-3 py-2 text-center text-sm font-semibold uppercase tracking-wider text-letterboxd-pro">
        Sean
      </div>
      <div className="px-3 py-2 text-center text-sm font-semibold uppercase tracking-wider text-letterboxd-pro">
        Amanda
      </div>
      <div className="px-3 py-2 text-center text-sm font-semibold uppercase tracking-wider text-letterboxd-pro">
        Winner
      </div>
    </div>

    {categories.map((cat, i) => {
      const seanPick = getSeanPick(cat);
      const amandaPick = getAmandaPick(cat);
      return (
        <div
          key={cat.order}
          className={`grid grid-cols-[25%_1fr_1fr_1fr] items-center min-h-[72px] border-b border-letterboxd-border/50 ${
            i % 2 === 0 ? "bg-letterboxd-bg-secondary/30" : ""
          }`}
        >
          <DesktopCategoryLabel category={cat} />
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
