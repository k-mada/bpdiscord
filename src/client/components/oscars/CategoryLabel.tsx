import { useState, useRef, useEffect } from "react";
import { OscarsCategory } from "../../types";

interface DesktopCategoryLabelProps {
  category: OscarsCategory;
}

interface MobileCategoryLabelProps {
  category: OscarsCategory;
  onTap: (cat: OscarsCategory) => void;
}

export const DesktopCategoryLabel = ({ category }: DesktopCategoryLabelProps) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showTooltip || !triggerRef.current || !tooltipRef.current) return;
    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const openBelow = triggerRect.bottom + tooltipRect.height + 4 <= window.innerHeight;

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
              <li key={nominee.title} className="text-xs text-letterboxd-text-primary">
                {nominee.title}
                {nominee.subtitle && (
                  <span className="text-letterboxd-text-muted"> — {nominee.subtitle}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export const MobileCategoryLabel = ({ category, onTap }: MobileCategoryLabelProps) => (
  <button
    className="px-3 py-2 text-sm font-semibold text-letterboxd-text-primary text-center underline decoration-dotted decoration-letterboxd-text-muted/50 underline-offset-2 cursor-pointer hover:text-letterboxd-pro transition-colors w-full"
    onClick={() => onTap(category)}
  >
    {category.category}
  </button>
);
