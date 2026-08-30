import { useRef } from "react";
import { OscarsViewMode } from "../../types";
import { VIEW_MODE_TABS } from "./constants";

interface ToggleProps {
  viewMode: OscarsViewMode;
  setViewMode: (mode: OscarsViewMode) => void;
}

const NEXT = ["ArrowRight", "ArrowDown"];
const PREV = ["ArrowLeft", "ArrowUp"];

// A radiogroup, not two toggle buttons: re-pressing an active toggle is a
// no-op, so going back needed a Shift+Tab that nothing announced.
const StickyToggle = ({ viewMode, setViewMode }: ToggleProps) => {
  const groupRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    const forward = NEXT.includes(event.key);
    if (!forward && !PREV.includes(event.key)) return;
    event.preventDefault();

    const current = VIEW_MODE_TABS.findIndex((tab) => tab.value === viewMode);
    const step = forward ? 1 : -1;
    const nextIndex =
      (current + step + VIEW_MODE_TABS.length) % VIEW_MODE_TABS.length;

    const buttons = groupRef.current?.querySelectorAll("button");
    buttons?.[nextIndex]?.focus();
    setViewMode(VIEW_MODE_TABS[nextIndex]!.value);
  };

  return (
    <div className="sticky top-0 z-20 bg-letterboxd-bg-primary/95 backdrop-blur-xs border-b border-letterboxd-border/30 -mx-2 sm:-mx-4 px-2 sm:px-4">
      <div className="flex justify-center py-2">
        <div
          ref={groupRef}
          role="radiogroup"
          aria-label="View mode"
          className="inline-flex rounded-lg border border-letterboxd-border overflow-hidden"
        >
          {VIEW_MODE_TABS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={viewMode === value}
              tabIndex={viewMode === value ? 0 : -1}
              onKeyDown={handleKeyDown}
              onClick={() => setViewMode(value)}
              className={`px-4 sm:px-5 py-1.5 text-sm font-semibold transition-colors ${
                viewMode === value
                  ? "bg-letterboxd-pro text-letterboxd-bg-primary"
                  : "bg-letterboxd-bg-secondary text-letterboxd-text-secondary hover:text-letterboxd-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StickyToggle;
