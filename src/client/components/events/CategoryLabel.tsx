import { useState, useRef, useEffect } from "react";
import { EventCategory, EventNominee } from "../../types";

interface DesktopCategoryLabelProps {
  category: EventCategory;
}

interface MobileCategoryLabelProps {
  category: EventCategory;
  onTap: (cat: EventCategory) => void;
}

const formatNominee = (
  nominee: EventNominee,
  displayMode: "movie_first" | "person_first"
) => {
  const primary =
    displayMode === "person_first" && nominee.personName
      ? nominee.personName
      : nominee.movieOrShowName;
  const secondary =
    displayMode === "person_first"
      ? nominee.movieOrShowName
      : nominee.personName;
  return { primary, secondary };
};

export const DesktopCategoryLabel = ({
  category,
}: DesktopCategoryLabelProps) => {
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

  return (
    <div
      ref={triggerRef}
      className="px-3 py-2"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="text-sm font-semibold text-letterboxd-text-primary underline decoration-dotted decoration-letterboxd-text-muted/50 underline-offset-2 cursor-default">
        {category.name}
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
            {category.nominees.map((nominee) => {
              const { primary, secondary } = formatNominee(
                nominee,
                category.displayMode
              );
              return (
                <li
                  key={nominee.id}
                  className="text-xs text-letterboxd-text-primary"
                >
                  {primary}
                  {secondary && (
                    <span className="text-letterboxd-text-muted">
                      {" "}
                      &mdash; {secondary}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
};

export const MobileCategoryLabel = ({
  category,
  onTap,
}: MobileCategoryLabelProps) => (
  <button
    className="px-3 py-2 text-sm font-semibold text-letterboxd-text-primary text-center underline decoration-dotted decoration-letterboxd-text-muted/50 underline-offset-2 cursor-pointer hover:text-letterboxd-pro transition-colors w-full"
    onClick={() => onTap(category)}
  >
    {category.name}
  </button>
);
