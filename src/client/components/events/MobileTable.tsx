import { EventCategory } from "../../types";
import { MobileCategoryLabel } from "./CategoryLabel";
import WinnerCell from "./WinnerCell";

interface MobileTableProps {
  categories: EventCategory[];
  onCategoryTap: (cat: EventCategory) => void;
}

const MobileTable = ({ categories, onCategoryTap }: MobileTableProps) => (
  <div className="space-y-1">
    {categories.map((cat, i) => {
      const winners = cat.nominees.filter((n) => n.isWinner);
      return (
        <div
          key={cat.id}
          className={`border-b border-letterboxd-border/50 ${
            i % 2 === 0 ? "bg-letterboxd-bg-secondary/30" : ""
          }`}
        >
          <div className="px-3 pt-3 pb-1 text-center">
            <MobileCategoryLabel category={cat} onTap={onCategoryTap} />
          </div>
          <div className="min-h-[56px]">
            <WinnerCell winners={winners} displayMode={cat.displayMode} />
          </div>
        </div>
      );
    })}
  </div>
);

export default MobileTable;
