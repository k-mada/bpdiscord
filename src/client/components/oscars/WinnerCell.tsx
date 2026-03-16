import { OscarsCategory } from "../../types";

const WinnerCell = ({ cat }: { cat: OscarsCategory }) => (
  <div className="flex items-center justify-center text-center px-2 py-2 md:px-3">
    {cat.actual_winner.length > 0 ? (
      <div className="flex flex-col gap-2">
        {cat.actual_winner.map((winner, i) => (
          <div key={i} className="inline-block px-2 py-1">
            <p
              className="text-base md:text-lg font-semibold text-letterboxd-text-primary leading-snug mb-0"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {/* <span className="mr-1">🏆</span> */}
              {winner.title}
            </p>
            {winner.subtitle && (
              <p className="text-[10px] md:text-xs text-letterboxd-text-muted">
                {winner.subtitle}
              </p>
            )}
          </div>
        ))}
      </div>
    ) : (
      <span className="text-letterboxd-text-muted text-xs">—</span>
    )}
  </div>
);

export default WinnerCell;
