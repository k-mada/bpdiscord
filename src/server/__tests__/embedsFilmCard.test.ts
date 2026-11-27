import {
  CardNode,
  POSTER_HEIGHT,
  POSTER_WIDTH,
  buildFilmCard,
  filmCardVersion,
  formatAverage,
} from "../embeds/filmCard";

const poster = { src: "data:image/jpeg;base64,AAAA", kind: "poster" as const };

function nodes(root: CardNode): CardNode[] {
  const { children } = root.props;
  const kids = Array.isArray(children) ? children : children && typeof children === "object" ? [children] : [];
  return [root, ...kids.flatMap(nodes)];
}

const texts = (root: CardNode) =>
  nodes(root)
    .map((n) => n.props.children)
    .filter((c): c is string => typeof c === "string");

const stars = (root: CardNode) =>
  nodes(root).filter((n) => n.type === "img" && n.props.src?.startsWith("data:image/svg+xml"));

describe("formatAverage", () => {
  it.each([
    [4.15, "4.15"],
    [4, "4.00"],
    [3.99000000953, "3.99"],
    [null, "—"],
  ])("%s → %s", (value, expected) => {
    expect(formatAverage(value)).toBe(expected);
  });
});

describe("filmCardVersion", () => {
  it("encodes every rendered number, URL-safe", () => {
    expect(
      filmCardVersion({ ratedCount: 17, averageRating: 4.15, letterboxdRating: 3.99000000953 }),
    ).toBe("17-4.15-3.99");
  });

  it("marks missing averages", () => {
    expect(
      filmCardVersion({ ratedCount: 0, averageRating: null, letterboxdRating: null }),
    ).toBe("0-na-na");
  });
});

describe("buildFilmCard", () => {
  it("renders the rated count above both averages, each with a star", () => {
    const card = buildFilmCard(
      { ratedCount: 17, averageRating: 4.15, letterboxdRating: 3.99 },
      poster,
    );

    expect(texts(card)).toEqual([
      "17 rated",
      "Our average: 4.15",
      "Letterboxd average: 3.99",
    ]);
    expect(stars(card)).toHaveLength(2);
  });

  it("shows a dash and no star for a missing average", () => {
    const card = buildFilmCard(
      { ratedCount: 0, averageRating: null, letterboxdRating: 3.99 },
      poster,
    );

    expect(texts(card)).toEqual([
      "0 rated",
      "Our average: —",
      "Letterboxd average: 3.99",
    ]);
    expect(stars(card)).toHaveLength(1);
  });

  it("fills the poster slot edge to edge with a real poster", () => {
    const card = buildFilmCard(
      { ratedCount: 1, averageRating: 4, letterboxdRating: 4 },
      poster,
    );
    const image = nodes(card).find((n) => n.props.src === poster.src);

    expect(image?.props).toMatchObject({
      width: POSTER_WIDTH,
      height: POSTER_HEIGHT,
      style: { objectFit: "cover" },
    });
  });

  it("insets the logo fallback instead of cropping it", () => {
    const logo = { src: "data:image/png;base64,BBBB", kind: "logo" as const };
    const card = buildFilmCard(
      { ratedCount: 1, averageRating: 4, letterboxdRating: 4 },
      logo,
    );
    const image = nodes(card).find((n) => n.props.src === logo.src);

    expect(image?.props.style).toEqual({ objectFit: "contain" });
    expect(image?.props.width).toBeLessThan(POSTER_WIDTH);
  });
});
