import { useEffect } from "react";
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
  winner: string;
}

const PickCell = ({ pick, isWinner }: { pick: Pick; isWinner: boolean }) => (
  <div className="flex items-center justify-center text-center px-3 py-2">
    <div
      className={`inline-block px-2 py-1 rounded ${
        isWinner ? "ring-2 ring-letterboxd-pro bg-letterboxd-pro/10" : ""
      }`}
    >
      <p
        className="text-lg font-semibold text-letterboxd-text-primary leading-snug mb-0"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        {pick.bolded_title}
      </p>
      {pick.subtitle && (
        <p className="text-xs text-letterboxd-text-muted">{pick.subtitle}</p>
      )}
    </div>
  </div>
);

const OscarsPage = () => {
  const categories = (oscarsData.categories as Category[]).sort(
    (a, b) => a.order - b.order,
  );

  // Override overflow on .main-content so sticky header works
  useEffect(() => {
    const main = document.querySelector<HTMLElement>(".main-content");
    if (main) {
      main.style.overflow = "visible";
      return () => {
        main.style.overflow = "";
      };
    }
  }, []);

  const seanWins = categories.filter((c) => c.winner === "sean").length;
  const amandaWins = categories.filter((c) => c.winner === "amanda").length;
  const hasAnyWinner = seanWins > 0 || amandaWins > 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="mb-10 text-center">
        <p className="uppercase tracking-[0.3em] text-letterboxd-pro text-xs font-semibold mb-3">
          The Big Picture
        </p>
        <h1
          className="text-4xl font-bold text-letterboxd-text-primary tracking-tight"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          Oscar Predictions
        </h1>
        <p className="text-5xl font-extralight text-letterboxd-pro mt-1">
          {oscarsData.year}
        </p>
        {hasAnyWinner && (
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

      {/* Grid Table */}
      <div className="card">
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
            <PickCell pick={cat.pick_sean} isWinner={cat.winner === "sean"} />
            <PickCell
              pick={cat.pick_amanda}
              isWinner={cat.winner === "amanda"}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

export default OscarsPage;
