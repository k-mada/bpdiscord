import { useState } from "react";
import oscarsData from "../data/oscars2026.json";
import { useMediaQuery } from "../hooks/useMediaQuery";

interface Pick {
  bolded_title: string;
  subtitle: string;
}

interface Category {
  order: number;
  category: string;
  pick_sean: Pick;
  pick_amanda: Pick;
  pick_sean_should_win: Pick;
  pick_amanda_should_win: Pick;
  winner: string;
}

type ViewMode = "will_win" | "should_win";

interface PickCellProps {
  pick: Pick;
  isWinner: boolean;
}

interface TableProps {
  categories: Category[];
  getSeanPick: (cat: Category) => Pick;
  getAmandaPick: (cat: Category) => Pick;
  viewMode: ViewMode;
}

interface ToggleProps {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
}

const STICKY_TOGGLE_HEIGHT = "top-[44px]";

const PickCell = ({ pick, isWinner }: PickCellProps) => (
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

const DesktopTable = ({
  categories,
  getSeanPick,
  getAmandaPick,
  viewMode,
}: TableProps) => (
  <div className="card">
    {/* Sticky header — sits below the sticky toggle */}
    <div
      className={`grid grid-cols-[35%_1fr_1fr] sticky ${STICKY_TOGGLE_HEIGHT} z-10 bg-letterboxd-bg-secondary shadow-md border-b border-letterboxd-pro/30`}
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
    </div>

    {categories.map((cat, i) => (
      <div
        key={cat.order}
        className={`grid grid-cols-[35%_1fr_1fr] items-center min-h-[72px] border-b border-letterboxd-border/50 ${
          i % 2 === 0 ? "bg-letterboxd-bg-secondary/30" : ""
        }`}
      >
        <div className="px-3 py-2 text-sm font-semibold text-letterboxd-text-primary">
          {cat.category}
        </div>
        <PickCell
          pick={getSeanPick(cat)}
          isWinner={cat.winner === "sean" && viewMode === "will_win"}
        />
        <PickCell
          pick={getAmandaPick(cat)}
          isWinner={cat.winner === "amanda" && viewMode === "will_win"}
        />
      </div>
    ))}
  </div>
);

const MobileTable = ({
  categories,
  getSeanPick,
  getAmandaPick,
  viewMode,
}: TableProps) => (
  <div className="space-y-1">
    {/* Sticky column labels — sits below the sticky toggle */}
    <div
      className={`grid grid-cols-2 sticky ${STICKY_TOGGLE_HEIGHT} z-10 bg-letterboxd-bg-secondary shadow-md border-b border-letterboxd-pro/30 rounded-t-lg`}
    >
      <div className="px-3 py-2 text-center text-sm font-semibold uppercase tracking-wider text-letterboxd-pro">
        Sean
      </div>
      <div className="px-3 py-2 text-center text-sm font-semibold uppercase tracking-wider text-letterboxd-pro">
        Amanda
      </div>
    </div>

    {categories.map((cat, i) => (
      <div
        key={cat.order}
        className={`border-b border-letterboxd-border/50 ${
          i % 2 === 0 ? "bg-letterboxd-bg-secondary/30" : ""
        }`}
      >
        <div className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-letterboxd-text-secondary text-center">
          {cat.category}
        </div>
        <div className="grid grid-cols-2 min-h-[56px]">
          <PickCell
            pick={getSeanPick(cat)}
            isWinner={cat.winner === "sean" && viewMode === "will_win"}
          />
          <PickCell
            pick={getAmandaPick(cat)}
            isWinner={cat.winner === "amanda" && viewMode === "will_win"}
          />
        </div>
      </div>
    ))}
  </div>
);

const OscarsPage = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("will_win");
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

  const tableProps: TableProps = {
    categories,
    getSeanPick,
    getAmandaPick,
    viewMode,
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
        <MobileTable {...tableProps} />
      )}
    </div>
  );
};

export default OscarsPage;
