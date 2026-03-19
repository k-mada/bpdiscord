import { EventCategory } from "../../types";
import { DesktopCategoryLabel } from "./CategoryLabel";
import WinnerCell from "./WinnerCell";

interface DesktopTableProps {
  categories: EventCategory[];
}

const DesktopTable = ({ categories }: DesktopTableProps) => (
  <div className="card">
    <div className="grid grid-cols-[40%_1fr] sticky top-0 z-10 bg-letterboxd-bg-secondary shadow-md border-b border-letterboxd-pro/30">
      <div className="px-3 py-2 text-left text-sm font-semibold uppercase tracking-wider text-letterboxd-pro">
        Category
      </div>
      <div className="px-3 py-2 text-center text-sm font-semibold uppercase tracking-wider text-letterboxd-pro">
        Winner
      </div>
    </div>

    {categories.map((cat, i) => {
      const winners = cat.nominees.filter((n) => n.isWinner);
      return (
        <div
          key={cat.id}
          className={`grid grid-cols-[40%_1fr] items-center min-h-[72px] border-b border-letterboxd-border/50 ${
            i % 2 === 0 ? "bg-letterboxd-bg-secondary/30" : ""
          }`}
        >
          <DesktopCategoryLabel category={cat} />
          <WinnerCell winners={winners} displayMode={cat.displayMode} />
        </div>
      );
    })}
  </div>
);

export default DesktopTable;
