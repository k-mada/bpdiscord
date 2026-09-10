import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Sizes a scroll container to fill from its own top edge down to the viewport
 * bottom, leaving `gap` px of breathing room. Returns a callback `ref` for the
 * element and the measured `maxHeight` in px (undefined until first measured).
 *
 * A max-height — not a fixed height — so a short table stays its natural size
 * and never scrolls, which keeps a sticky header from activating when there is
 * nothing to scroll. The callback ref re-measures when the element attaches,
 * so it works even when the container mounts after data loads.
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
