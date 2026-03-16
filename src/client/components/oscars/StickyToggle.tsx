import { OscarsViewMode } from "../../types";
import { VIEW_MODE_TABS } from "./constants";

interface ToggleProps {
  viewMode: OscarsViewMode;
  setViewMode: (mode: OscarsViewMode) => void;
}

const StickyToggle = ({ viewMode, setViewMode }: ToggleProps) => (
  <div className="sticky top-0 z-20 bg-letterboxd-bg-primary/95 backdrop-blur-sm border-b border-letterboxd-border/30 -mx-2 sm:-mx-4 px-2 sm:px-4">
    <div className="flex justify-center py-2">
      <div className="inline-flex rounded-lg border border-letterboxd-border overflow-hidden">
        {VIEW_MODE_TABS.map(({ value, label }) => (
          <button
            key={value}
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

export default StickyToggle;
