import {
  NOT_FOUND_TITLE,
  SITE_NAME,
  documentTitleForPath,
  titleForPath,
} from "../components/routeTitles";

describe("titleForPath", () => {
  it.each([
    ["/", "Home"],
    ["/stats", "Stats"],
    ["/mfl", "Movie Fantasy League"],
    ["/mfl/scoring-reference", "Scoring reference"],
    ["/compare", "Compare users"],
    ["/hater-rankings", "Hater Rankings"],
    ["/actor-graph", "Six Degrees"],
    ["/dashboard/refresh-films", "Refresh films"],
  ])("names the static route %s", (pathname, expected) => {
    expect(titleForPath(pathname)).toBe(expected);
  });

  // Four routes would otherwise share one indistinguishable title.
  it.each([
    ["/user/kevin", "kevin"],
    ["/film/anatomy-of-a-fall", "anatomy-of-a-fall"],
    ["/events/oscars-2027", "Event: oscars-2027"],
    ["/events/oscars-2027/my-picks", "My picks: oscars-2027"],
  ])("resolves the parameter in %s", (pathname, expected) => {
    expect(titleForPath(pathname)).toBe(expected);
  });

  // The one ordering constraint in the table: both patterns match exactly.
  it("prefers the literal segment over the dynamic one", () => {
    expect(titleForPath("/events/admin")).toBe("Events admin");
  });

  it.each(["/nope", "/events/a/b/c", "/user"])(
    "falls back for the unmatched %s",
    (pathname) => {
      expect(titleForPath(pathname)).toBe(NOT_FOUND_TITLE);
    },
  );

  it("does not treat a prefix as a match", () => {
    expect(titleForPath("/statistics")).toBe(NOT_FOUND_TITLE);
  });
});

describe("documentTitleForPath", () => {
  it("trails the site name so tabs stay readable", () => {
    expect(documentTitleForPath("/compare")).toBe(
      `Compare users — ${SITE_NAME}`,
    );
  });
});
