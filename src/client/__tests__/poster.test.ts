import { posterAtWidth } from "../lib/poster";

const url = (w: number, h: number) =>
  `https://a.ltrbxd.com/resized/film-poster/1/2/3/heat-0-${w}-0-${h}-crop.jpg`;

describe("posterAtWidth", () => {
  // The CDN 403s any crop size it hasn't generated, so every rewrite has to
  // land on one of its widths rather than on the exact size we asked for.
  it("snaps up to the next crop width the CDN serves", () => {
    expect(posterAtWidth(url(230, 345), 320)).toBe(url(400, 600));
    expect(posterAtWidth(url(230, 345), 460)).toBe(url(460, 690));
    expect(posterAtWidth(url(230, 345), 640)).toBe(url(1000, 1500));
  });

  it("scales from whatever size the stored URL carries", () => {
    expect(posterAtWidth(url(300, 450), 460)).toBe(url(460, 690));
  });

  it("shrinks an oversized source to the requested width", () => {
    expect(posterAtWidth(url(1000, 1500), 320)).toBe(url(400, 600));
  });

  it("caps at the largest available width", () => {
    expect(posterAtWidth(url(230, 345), 4000)).toBe(url(1000, 1500));
  });

  it("leaves a URL that already matches the snapped width alone", () => {
    expect(posterAtWidth(url(400, 600), 320)).toBe(url(400, 600));
  });

  it("passes through a URL with no crop segment", () => {
    const plain = "https://example.com/poster.jpg";
    expect(posterAtWidth(plain, 320)).toBe(plain);
  });

  it("passes through an empty string", () => {
    expect(posterAtWidth("", 320)).toBe("");
  });
});
