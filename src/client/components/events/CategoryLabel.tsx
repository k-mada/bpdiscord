import { EventCategory } from "../../types";

interface CategoryLabelProps {
  category: EventCategory;
  onTap: (cat: EventCategory) => void;
}

// Clears the sticky table header when a focused button is scrolled into view.
const SCROLL_MT = "scroll-mt-[40px]";

const LABEL =
  "text-sm font-semibold text-letterboxd-text-primary underline decoration-dotted " +
  "decoration-letterboxd-text-muted/50 underline-offset-2 cursor-pointer " +
  "hover:text-letterboxd-pro transition-colors";

export const DesktopCategoryLabel = ({
  category,
  onTap,
}: CategoryLabelProps) => (
  <button
    type="button"
    onClick={() => onTap(category)}
    className={`${LABEL} text-left ${SCROLL_MT}`}
  >
    {category.name}
  </button>
);

export const MobileCategoryLabel = ({
  category,
  onTap,
}: CategoryLabelProps) => (
  <button
    type="button"
    onClick={() => onTap(category)}
    className={`${LABEL} w-full px-3 py-2 text-center`}
  >
    {category.name}
  </button>
);
