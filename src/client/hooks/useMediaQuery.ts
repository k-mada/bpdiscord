import { useState, useEffect } from "react";

/**
 * React hook that tracks whether a CSS media query matches.
 * Uses window.matchMedia for efficient, event-driven updates
 * (no polling or resize listeners needed).
 *
 * @param query - A CSS media query string, e.g. "(min-width: 768px)"
 * @returns boolean indicating whether the query currently matches
 */
export const useMediaQuery = (query: string): boolean => {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);

  useEffect(() => {
    const mediaQuery = window.matchMedia(query);
    setMatches(mediaQuery.matches);

    const handleChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [query]);

  return matches;
};
