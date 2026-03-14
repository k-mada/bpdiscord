import { useState } from "react";
import oscarsData from "../data/oscars2026.json";

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

const PickCell = ({ pick, isWinner }: { pick: Pick; isWinner: boolean }) => (
  <div className="flex items-center justify-center text-center px-2 py-2 sm:px-3">
    <div
      className={`inline-block px-2 py-1 rounded ${
        isWinner ? "ring-2 ring-letterboxd-pro bg-letterboxd-pro/10" : ""
      }`}
    >
      <p
        className="text-base sm:text-lg font-semibold text-letterboxd-text-primary leading-snug mb-0"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        {pick.bolded_title}
      </p>
      {pick.subtitle && (
        <p className="text-[10px] sm:text-xs text-letterboxd-text-muted">
          {pick.subtitle}
        </p>
      )}
    </div>
  </div>
);

const OscarsPage = () => {
  const [viewMode, setViewMode] = useState<ViewMode>("will_win");

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

  return (
    <div className="oscars-page max-w-4xl mx-auto px-2 sm:px-4 py-8 sm:py-12">
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

        {/* Toggle */}
        <div className="mt-6 inline-flex rounded-lg border border-letterboxd-border overflow-hidden">
          <button
            onClick={() => setViewMode("will_win")}
            className={`px-4 sm:px-5 py-2 text-sm font-semibold transition-colors ${
              viewMode === "will_win"
                ? "bg-letterboxd-pro text-letterboxd-bg-primary"
                : "bg-letterboxd-bg-secondary text-letterboxd-text-secondary hover:text-letterboxd-text-primary"
            }`}
          >
            Who Will Win
          </button>
          <button
            onClick={() => setViewMode("should_win")}
            className={`px-4 sm:px-5 py-2 text-sm font-semibold transition-colors ${
              viewMode === "should_win"
                ? "bg-letterboxd-pro text-letterboxd-bg-primary"
                : "bg-letterboxd-bg-secondary text-letterboxd-text-secondary hover:text-letterboxd-text-primary"
            }`}
          >
            Who Should Win
          </button>
        </div>

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

      {/* Desktop: 3-column grid table */}
      <div className="card hidden md:block">
        {/* Sticky header */}
        <div className="grid grid-cols-[35%_1fr_1fr] sticky top-0 z-10 bg-letterboxd-bg-secondary shadow-md border-b border-letterboxd-pro/30">
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

        {/* Rows */}
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

      {/* Mobile: card layout with category header + 2-column picks */}
      <div className="md:hidden space-y-1">
        {/* Sticky column labels */}
        <div className="grid grid-cols-2 sticky top-0 z-10 bg-letterboxd-bg-secondary shadow-md border-b border-letterboxd-pro/30 rounded-t-lg">
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
            {/* Category name as full-width header */}
            <div className="px-3 pt-3 pb-1 text-xs font-semibold uppercase tracking-wider text-letterboxd-text-secondary text-center">
              {cat.category}
            </div>
            {/* 2-column picks */}
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
    </div>
  );
};

export default OscarsPage;
