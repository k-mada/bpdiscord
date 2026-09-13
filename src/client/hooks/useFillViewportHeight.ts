import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Sizes a scroll container from its top edge to the viewport bottom, less `gap`
 * px. Returns a callback `ref` and the measured `maxHeight` (undefined until
 * first measured). A max-height, not a fixed height, lets a short table keep its
 * natural size so a sticky header never activates with nothing to scroll.
 */
export function useFillViewportHeight<T extends HTMLElement>(gap = 32) {
  const elRef = useRef<T | null>(null);
  const [maxHeight, setMaxHeight] = useState<number>();

  const measure = useCallback(() => {
    const el = elRef.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top;
    setMaxHeight(Math.max(window.innerHeight - top - gap, 0));
  }, [gap]);

  const ref = useCallback(
    (node: T | null) => {
      elRef.current = node;
      if (node) measure();
    },
    [measure],
  );

  useEffect(() => {
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return { ref, maxHeight };
}
