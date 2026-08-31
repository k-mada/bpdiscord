import { matchPath } from "react-router-dom";

export const SITE_NAME = "The Big Picture Discord";

type RouteParams = Record<string, string | undefined>;
type RouteTitle = string | ((params: RouteParams) => string);

// matchPath is exact, so ordering only matters where a literal segment and a
// dynamic one both fit: /events/admin must precede /events/:slug.
const ROUTE_TITLES: Array<[string, RouteTitle]> = [
  ["/", "Home"],
  ["/stats", "Stats"],
  ["/mfl", "Movie Fantasy League"],
  ["/mfl/scoring-reference", "Scoring reference"],
  ["/mfl/admin", "Movie Fantasy League admin"],
  ["/compare", "Compare users"],
  ["/movie-swap", "Movie Swap"],
  ["/hater-rankings", "Hater Rankings"],
  ["/oscars-2026", "Oscars 2026"],
  ["/events", "Events"],
  ["/events/admin", "Events admin"],
  ["/events/:slug/my-picks", ({ slug }) => `My picks: ${slug ?? "event"}`],
  ["/events/:slug", ({ slug }) => `Event: ${slug ?? "event"}`],
  ["/actor-graph", "Six Degrees"],
  ["/login", "Log in"],
  ["/signup", "Sign up"],
  ["/forgot-password", "Forgot password"],
  ["/reset-password", "Reset password"],
  ["/dashboard", "Dashboard"],
  ["/dashboard/refresh-films", "Refresh films"],
  ["/admin/users", "User admin"],
  ["/user/:username", ({ username }) => username ?? "User profile"],
  ["/film/:filmSlug", ({ filmSlug }) => filmSlug ?? "Film"],
  ["/fetcher", "Data Fetcher"],
];

export const NOT_FOUND_TITLE = "Page not found";

/** The route name on its own, for announcing. Never includes the site name. */
export const titleForPath = (pathname: string): string => {
  for (const [pattern, title] of ROUTE_TITLES) {
    const match = matchPath(pattern, pathname);
    if (match) return typeof title === "function" ? title(match.params) : title;
  }
  return NOT_FOUND_TITLE;
};

/** What document.title becomes. The site name trails so tabs stay readable. */
export const documentTitleForPath = (pathname: string): string =>
  `${titleForPath(pathname)} — ${SITE_NAME}`;
