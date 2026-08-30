import { EventCategory } from "../../types";
import { DesktopCategoryLabel } from "./CategoryLabel";
import WinnerCell from "./WinnerCell";

interface DesktopTableProps {
  categories: EventCategory[];
  onCategoryTap: (cat: EventCategory) => void;
}

const HEADER_CELL =
  "px-3 py-2 text-sm font-semibold uppercase tracking-wider text-letterboxd-pro";

// Explicit roles, not a <table>: display:grid strips the implicit table
// semantics of native table elements in Chrome and Firefox.
const DesktopTable = ({ categories, onCategoryTap }: DesktopTableProps) => (
  <div className="card" role="table" aria-label="Winners by category">
    <div
      role="row"
      className="grid grid-cols-[40%_1fr] sticky top-0 z-10 bg-letterboxd-bg-secondary shadow-md border-b border-letterboxd-pro/30"
    >
      <div role="columnheader" className={`${HEADER_CELL} text-left`}>
        Category
      </div>
      <div role="columnheader" className={`${HEADER_CELL} text-center`}>
        Winner
      </div>
    </div>

    {categories.map((cat, i) => {
      const winners = cat.nominees.filter((n) => n.isWinner);
      return (
        <div
          key={cat.id}
          role="row"
          className={`grid grid-cols-[40%_1fr] items-center min-h-[72px] border-b border-letterboxd-border/50 ${
            i % 2 === 0 ? "bg-letterboxd-bg-secondary/30" : ""
          }`}
        >
          <div role="rowheader" className="px-3 py-2">
            <DesktopCategoryLabel category={cat} onTap={onCategoryTap} />
          </div>
          <WinnerCell winners={winners} displayMode={cat.displayMode} />
        </div>
      );
    })}
  </div>
);

export default DesktopTable;
