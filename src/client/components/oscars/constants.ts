export const STICKY_TOGGLE_HEIGHT = "top-[44px]";

// Focused category buttons scroll out from under the sticky stack: the toggle
// bar plus the table header that sits below it.
export const CATEGORY_SCROLL_MT_DESKTOP = "scroll-mt-[84px]";
export const CATEGORY_SCROLL_MT_MOBILE = "scroll-mt-[80px]";

export const VIEW_MODE_TABS = [
  { value: "will_win", label: "Who Will Win" },
  { value: "should_win", label: "Who Should Win" },
] as const;
