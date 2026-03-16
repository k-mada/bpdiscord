import { useState } from "react";
import oscarsData from "../data/oscars2026.json";
import { useMediaQuery } from "../hooks/useMediaQuery";
import { OscarsCategory, OscarsPrediction, OscarsViewMode } from "../types";
import NomineesModal from "./oscars/NomineesModal";
import StickyToggle from "./oscars/StickyToggle";
import DesktopTable from "./oscars/DesktopTable";
import MobileTable from "./oscars/MobileTable";

const OscarsPage = () => {
  const [viewMode, setViewMode] = useState<OscarsViewMode>("will_win");
  const [modalCategory, setModalCategory] = useState<OscarsCategory | null>(null);
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const categories = (oscarsData.categories as OscarsCategory[])
    .sort((a, b) => a.order - b.order)
    .filter((cat) => {
      if (viewMode === "should_win") {
        return (
          cat.pick_sean_should_win.title !== "" ||
          cat.pick_amanda_should_win.title !== ""
        );
      }
      return true;
    });

  const seanWins = categories.filter((c) => c.winner === "sean").length;
  const amandaWins = categories.filter((c) => c.winner === "amanda").length;
  const hasAnyWinner = seanWins > 0 || amandaWins > 0;

  const getSeanPick = (cat: OscarsCategory): OscarsPrediction =>
    viewMode === "should_win" ? cat.pick_sean_should_win : cat.pick_sean;
  const getAmandaPick = (cat: OscarsCategory): OscarsPrediction =>
    viewMode === "should_win" ? cat.pick_amanda_should_win : cat.pick_amanda;

  return (
    <div className="oscars-page max-w-4xl mx-auto px-2 sm:px-4">
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
            {[
              { label: "Sean", wins: seanWins },
              { label: "Amanda", wins: amandaWins },
            ].map(({ label, wins }) => (
              <div key={label} className="text-center">
                <p className="text-2xl font-bold text-letterboxd-pro">{wins}</p>
                <p className="text-xs uppercase tracking-wider text-letterboxd-text-muted mt-1">
                  {label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      <StickyToggle viewMode={viewMode} setViewMode={setViewMode} />

      {isDesktop ? (
        <DesktopTable
          categories={categories}
          getSeanPick={getSeanPick}
          getAmandaPick={getAmandaPick}
          viewMode={viewMode}
        />
      ) : (
        <MobileTable
          categories={categories}
          getSeanPick={getSeanPick}
          getAmandaPick={getAmandaPick}
          viewMode={viewMode}
          onCategoryTap={setModalCategory}
        />
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
