import { useState, useRef, useEffect } from "react";
import oscarsData from "../data/oscars2026.json";
import { useMediaQuery } from "../hooks/useMediaQuery";

interface Pick {
  bolded_title: string;
  subtitle: string;
}

interface Category {
  order: number;
  category: string;
  nominees: string[];
  pick_sean: Pick;
  pick_amanda: Pick;
  pick_sean_should_win: Pick;
  pick_amanda_should_win: Pick;
  winner: string;
  actual_winner: string;
}

type ViewMode = "will_win" | "should_win";

interface PickCellProps {
  pick: Pick;
  isWinner: boolean;
  isCorrectPick: boolean;
}

interface TableProps {
  categories: Category[];
  getSeanPick: (cat: Category) => Pick;
  getAmandaPick: (cat: Category) => Pick;
  viewMode: ViewMode;
  isCorrectPick: (pick: Pick, cat: Category) => boolean;
}

interface ToggleProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

interface NomineesModalProps {
  category: string;
  nominees: string[];
  onClose: () => void;
}

interface CategoryLabelProps {
  category: Category;
  isDesktop: boolean;
  onMobileTap: (cat: Category) => void;
}

const STICKY_TOGGLE_HEIGHT = "top-[44px]";

const NomineesModal = ({ category, nominees, onClose }: NomineesModalProps) => (
  <div
    className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
    onClick={onClose}
  >
    <div
      className="w-full max-w-lg bg-letterboxd-bg-secondary rounded-t-2xl p-5 pb-8 animate-slide-up"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="flex justify-between items-center mb-4">
        <h3
          className="text-lg font-bold text-letterboxd-pro"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {category}
        </h3>
        <button
          onClick={onClose}
          className="text-letterboxd-text-muted hover:text-letterboxd-text-primary text-2xl leading-none px-2"
        >
          &times;
        </button>
      </div>
      <p className="text-[10px] uppercase tracking-widest text-letterboxd-text-muted mb-3">
        Nominees
      </p>
      <ul className="space-y-2">
        {nominees.map((nominee) => (
          <li
            key={nominee}
            className="text-sm text-letterboxd-text-primary border-b border-letterboxd-border/30 pb-2 last:border-0"
          >
            {nominee}
          </li>
        ))}
      </ul>
    </div>
  </div>
);

const CategoryLabel = ({
  category,
  isDesktop,
  onMobileTap,
}: CategoryLabelProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showTooltip || !triggerRef.current || !tooltipRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const openBelow =
      triggerRect.bottom + tooltipRect.height + 4 <= window.innerHeight;

    setTooltipStyle({
      left: triggerRect.left,
      top: openBelow
        ? triggerRect.bottom + 4
        : triggerRect.top - tooltipRect.height - 4,
    });
  }, [showTooltip]);

  if (!isDesktop) {
    return (
      <button
        className="px-3 py-2 text-sm font-semibold text-letterboxd-text-primary text-center underline decoration-dotted decoration-letterboxd-text-muted/50 underline-offset-2 cursor-pointer hover:text-letterboxd-pro transition-colors w-full"
        onClick={() => onMobileTap(category)}
      >
        {category.category}
      </button>
    );
  }

  return (
    <div
      ref={triggerRef}
      className="px-3 py-2"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="text-sm font-semibold text-letterboxd-text-primary underline decoration-dotted decoration-letterboxd-text-muted/50 underline-offset-2 cursor-default">
        {category.category}
      </span>
      {showTooltip && (
        <div
          ref={tooltipRef}
          style={tooltipStyle}
          className="fixed z-30 w-72 bg-letterboxd-bg-secondary border border-letterboxd-border rounded-lg shadow-xl p-3"
        >
          <p className="text-[10px] uppercase tracking-widest text-letterboxd-pro mb-2 font-semibold">
            Nominees
          </p>
          <ul className="space-y-1.5">
            {category.nominees.map((nominee) => (
              <li
                key={nominee}
                className="text-xs text-letterboxd-text-primary"
              >
                {nominee}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

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
        {isCorrectPick && <span className="mr-1">🏆</span>}
        {pick.bolded_title}
      </p>
      {pick.subtitle && (
        <p className="text-[10px] md:text-xs text-letterboxd-text-muted">
          {pick.subtitle}
        </p>
      )}
    </div>
  </div>
);

const StickyToggle = ({ viewMode, setViewMode }: ToggleProps) => (
  <div className="sticky top-0 z-20 bg-letterboxd-bg-primary/95 backdrop-blur-sm border-b border-letterboxd-border/30 -mx-2 sm:-mx-4 px-2 sm:px-4">
    <div className="flex justify-center py-2">
      <div className="inline-flex rounded-lg border border-letterboxd-border overflow-hidden">
        <button
          onClick={() => setViewMode("will_win")}
          className={`px-4 sm:px-5 py-1.5 text-sm font-semibold transition-colors ${
            viewMode === "will_win"
              ? "bg-letterboxd-pro text-letterboxd-bg-primary"
              : "bg-letterboxd-bg-secondary text-letterboxd-text-secondary hover:text-letterboxd-text-primary"
          }`}
        >
          Who Will Win
        </button>
        <button
          onClick={() => setViewMode("should_win")}
          className={`px-4 sm:px-5 py-1.5 text-sm font-semibold transition-colors ${
            viewMode === "should_win"
              ? "bg-letterboxd-pro text-letterboxd-bg-primary"
              : "bg-letterboxd-bg-secondary text-letterboxd-text-secondary hover:text-letterboxd-text-primary"
          }`}
        >
          Who Should Win
        </button>
      </div>
    </div>
  </div>
);

const WinnerCell = ({ cat }: { cat: Category }) => (
  <div className="flex items-center justify-center text-center px-2 py-2 md:px-3">
    {cat.actual_winner ? (
      <p
        className="text-base md:text-lg font-semibold text-letterboxd-text-primary leading-snug mb-0"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        <span className="mr-1">🏆</span>
        {cat.actual_winner}
      </p>
    ) : (
      <span className="text-letterboxd-text-muted text-xs">—</span>
    )}
  </div>
);

const DesktopTable = ({
  categories,
  getSeanPick,
  getAmandaPick,
  viewMode,
  isCorrectPick,
}: TableProps) => (
  <div className="card">
    {/* Sticky header — sits below the sticky toggle */}
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

    {categories.map((cat, i) => (
      <div
        key={cat.order}
        className={`grid grid-cols-[25%_1fr_1fr_1fr] items-center min-h-[72px] border-b border-letterboxd-border/50 ${
          i % 2 === 0 ? "bg-letterboxd-bg-secondary/30" : ""
        }`}
      >
        <CategoryLabel category={cat} isDesktop onMobileTap={() => {}} />
        <PickCell
          pick={getSeanPick(cat)}
          isWinner={cat.winner === "sean" && viewMode === "will_win"}
          isCorrectPick={isCorrectPick(getSeanPick(cat), cat)}
        />
        <PickCell
          pick={getAmandaPick(cat)}
          isWinner={cat.winner === "amanda" && viewMode === "will_win"}
          isCorrectPick={isCorrectPick(getAmandaPick(cat), cat)}
        />
        <WinnerCell cat={cat} />
      </div>
    ))}
  </div>
);

interface MobileTableProps extends TableProps {
  onCategoryTap: (cat: Category) => void;
}

const MobileTable = ({
  categories,
  getSeanPick,
  getAmandaPick,
  viewMode,
  onCategoryTap,
  isCorrectPick,
}: MobileTableProps) => (
  <div className="space-y-1">
    {/* Sticky column labels — sits below the sticky toggle */}
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

    {categories.map((cat, i) => (
      <div
        key={cat.order}
        className={`border-b border-letterboxd-border/50 ${
          i % 2 === 0 ? "bg-letterboxd-bg-secondary/30" : ""
        }`}
      >
        <div className="px-3 pt-3 pb-1 text-center">
          <CategoryLabel
            category={cat}
            isDesktop={false}
            onMobileTap={onCategoryTap}
          />
        </div>
        <div className="grid grid-cols-3 min-h-[56px]">
          <PickCell
            pick={getSeanPick(cat)}
            isWinner={cat.winner === "sean" && viewMode === "will_win"}
            isCorrectPick={isCorrectPick(getSeanPick(cat), cat)}
          />
          <PickCell
            pick={getAmandaPick(cat)}
            isWinner={cat.winner === "amanda" && viewMode === "will_win"}
            isCorrectPick={isCorrectPick(getAmandaPick(cat), cat)}
          />
          <WinnerCell cat={cat} />
        </div>
      </div>
    ))}
  </div>
);

const OscarsPage = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("will_win");
  const [modalCategory, setModalCategory] = useState<Category | null>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const categories = (oscarsData.categories as Category[])
    .sort((a, b) => a.order - b.order)
    .filter((cat) => {
      if (viewMode === "should_win") {
        return (
          cat.pick_sean_should_win.bolded_title !== "" ||
          cat.pick_amanda_should_win.bolded_title !== ""
        );
      }
      return true;
    });

  const seanWins = categories.filter((c) => c.winner === "sean").length;
  const amandaWins = categories.filter((c) => c.winner === "amanda").length;
  const hasAnyWinner = seanWins > 0 || amandaWins > 0;

  const getSeanPick = (cat: Category) =>
    viewMode === "should_win" ? cat.pick_sean_should_win : cat.pick_sean;
  const getAmandaPick = (cat: Category) =>
    viewMode === "should_win" ? cat.pick_amanda_should_win : cat.pick_amanda;

  const isCorrectPick = (pick: Pick, cat: Category) =>
    cat.actual_winner !== "" &&
    (pick.bolded_title.toLowerCase() === cat.actual_winner.toLowerCase() ||
      cat.actual_winner.toLowerCase().startsWith(pick.bolded_title.toLowerCase()));

  const tableProps: TableProps = {
    categories,
    getSeanPick,
    getAmandaPick,
    viewMode,
    isCorrectPick,
  };

  return (
    <div className="oscars-page max-w-4xl mx-auto px-2 sm:px-4">
      {/* Header */}
      <div className="mb-8 sm:mb-10 text-center">
        <p className="uppercase tracking-[0.3em] text-letterboxd-pro text-xs font-semibold mb-3">
          The Big Picture
        </p>
        <h1
          className="text-3xl sm:text-4xl font-bold text-letterboxd-text-primary tracking-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Oscar Predictions
        </h1>
        <p className="text-4xl sm:text-5xl font-extralight text-letterboxd-pro mt-1">
          {oscarsData.year}
        </p>

        {hasAnyWinner && viewMode === "will_win" && (
          <div className="flex justify-center gap-10 mt-6">
            <div className="text-center">
              <p className="text-2xl font-bold text-letterboxd-pro">
                {seanWins}
              </p>
              <p className="text-xs uppercase tracking-wider text-letterboxd-text-muted mt-1">
                Sean
              </p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-letterboxd-pro">
                {amandaWins}
              </p>
              <p className="text-xs uppercase tracking-wider text-letterboxd-text-muted mt-1">
                Amanda
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Sticky toggle bar */}
      <StickyToggle viewMode={viewMode} setViewMode={setViewMode} />

      {isDesktop ? (
        <DesktopTable {...tableProps} />
      ) : (
        <MobileTable {...tableProps} onCategoryTap={setModalCategory} />
      )}

      {modalCategory && (
        <NomineesModal
          category={modalCategory.category}
          nominees={modalCategory.nominees}
          onClose={() => setModalCategory(null)}
        />
      )}
    </div>
  );
};

export default OscarsPage;
