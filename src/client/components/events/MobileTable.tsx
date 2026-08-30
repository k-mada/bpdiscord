import { EventCategory } from "../../types";
import { MobileCategoryLabel } from "./CategoryLabel";
import WinnerCell from "./WinnerCell";

interface MobileTableProps {
  categories: EventCategory[];
  onCategoryTap: (cat: EventCategory) => void;
}

const MobileTable = ({ categories, onCategoryTap }: MobileTableProps) => (
  <div className="space-y-1" role="table" aria-label="Winners by category">
    {/* The mobile layout stacks a category over its winner, so it shows no
        header. Screen readers still get the column names from here. */}
    <div role="row" className="sr-only">
      <div role="columnheader">Category</div>
      <div role="columnheader">Winner</div>
    </div>

    {categories.map((cat, i) => {
      const winners = cat.nominees.filter((n) => n.isWinner);
      return (
        <div
          key={cat.id}
          role="row"
          className={`border-b border-letterboxd-border/50 ${
            i % 2 === 0 ? "bg-letterboxd-bg-secondary/30" : ""
          }`}
        >
          <div role="rowheader" className="px-3 pt-3 pb-1 text-center">
            <MobileCategoryLabel category={cat} onTap={onCategoryTap} />
          </div>
          <WinnerCell winners={winners} displayMode={cat.displayMode} />
        </div>
      );
    })}
  </div>
);

export default MobileTable;
