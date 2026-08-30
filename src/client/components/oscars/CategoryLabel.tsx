import { OscarsCategory } from "../../types";
import {
  CATEGORY_SCROLL_MT_DESKTOP,
  CATEGORY_SCROLL_MT_MOBILE,
} from "./constants";

interface CategoryLabelProps {
  category: OscarsCategory;
  onTap: (cat: OscarsCategory) => void;
}

const LABEL =
  "text-sm font-semibold text-letterboxd-text-primary underline decoration-dotted " +
  "decoration-letterboxd-text-muted/50 underline-offset-2 cursor-pointer " +
  "hover:text-letterboxd-pro transition-colors";

export const DesktopCategoryLabel = ({ category, onTap }: CategoryLabelProps) => (
  <button
    type="button"
    onClick={() => onTap(category)}
    className={`${LABEL} text-left ${CATEGORY_SCROLL_MT_DESKTOP}`}
  >
    {category.category}
  </button>
);

export const MobileCategoryLabel = ({ category, onTap }: CategoryLabelProps) => (
  <button
    type="button"
    onClick={() => onTap(category)}
    className={`${LABEL} w-full px-3 py-2 text-center ${CATEGORY_SCROLL_MT_MOBILE}`}
  >
    {category.category}
  </button>
);
