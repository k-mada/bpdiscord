import tailwindConfig from "../tailwind.config.js";

/**
 * Contrast gate for the letterboxd-* palette (WCAG 2.2 AA).
 *
 * jsdom cannot evaluate colour contrast — axe needs real layout and computed
 * backgrounds — so this reads the tokens directly and does the maths. Without
 * it nothing in CI stops a palette edit from silently reintroducing a failure.
 */

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3.0;

type Token =
  | "bg-primary"
  | "bg-secondary"
  | "bg-tertiary"
  | "text-primary"
  | "text-secondary"
  | "text-muted"
  | "accent"
  | "accent-hover"
  | "pro"
  | "border"
  | "border-light"
  | "link-hover";

const palette = (
  tailwindConfig as {
    theme: { extend: { colors: { letterboxd: Record<Token, string> } } };
  }
).theme.extend.colors.letterboxd;

interface Rgb {
  r: number;
  g: number;
  b: number;
}

const channels = (hex: string): Rgb => {
  const h = hex.replace("#", "");
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
};

const toHex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("")}`;

/** Flatten a translucent layer onto an opaque one, as the browser composites it. */
const composite = (fg: string, bg: string, alpha: number): string => {
  const f = channels(fg);
  const b = channels(bg);
  const mix = (top: number, bottom: number) => bottom + alpha * (top - bottom);
  return toHex({
    r: mix(f.r, b.r),
    g: mix(f.g, b.g),
    b: mix(f.b, b.b),
  });
};

const relativeLuminance = (hex: string): number => {
  const linear = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const { r, g, b } = channels(hex);
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
};

const contrast = (a: string, b: string): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
};

const bg = {
  primary: palette["bg-primary"],
  secondary: palette["bg-secondary"],
  tertiary: palette["bg-tertiary"],
};

// Oscars/Events render rows and winner cells on translucent layers, so the
// effective background is neither token — it has to be composited first.
const stripe = composite(bg.secondary, bg.primary, 0.3);
const winnerTint = composite(palette.pro, bg.primary, 0.1);

const surfaces: Array<[string, string]> = [
  ["bg-primary", bg.primary],
  ["bg-secondary", bg.secondary],
  ["bg-tertiary", bg.tertiary],
  ["row stripe (bg-secondary/30)", stripe],
  ["winner tint (pro/10)", winnerTint],
];

describe("letterboxd palette contrast (WCAG 2.2 AA)", () => {
  describe.each(surfaces)("on %s", (_name, surface) => {
    const textTokens: Token[] = ["text-primary", "text-secondary", "text-muted"];

    it.each(textTokens)("%s meets 4.5:1", (token) => {
      expect(contrast(palette[token], surface)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  it("btn-primary label meets 4.5:1 on the accent background", () => {
    expect(contrast("#000000", palette["accent"])).toBeGreaterThanOrEqual(AA_TEXT);
    expect(contrast("#000000", palette["accent-hover"])).toBeGreaterThanOrEqual(AA_TEXT);
  });

  it("control borders meet 3:1 against the field background", () => {
    expect(
      contrast(palette["border-light"], bg.secondary),
    ).toBeGreaterThanOrEqual(AA_NON_TEXT);
  });

  it("the focus indicator meets 3:1 on every surface", () => {
    for (const [, surface] of surfaces) {
      expect(contrast(palette["text-primary"], surface)).toBeGreaterThanOrEqual(
        AA_NON_TEXT,
      );
    }
  });

  it("keeps text-secondary and text-muted visually distinct", () => {
    const ratio =
      relativeLuminance(palette["text-secondary"]) /
      relativeLuminance(palette["text-muted"]);
    expect(ratio).toBeGreaterThan(1.2);
  });

  // Guards the two call sites this PR fixed; accent is a brand colour and stays
  // legal as a large-text/graphical accent, just not as body copy on cards.
  it("accent is not treated as body text on bg-tertiary", () => {
    expect(contrast(palette["accent"], bg.tertiary)).toBeLessThan(AA_TEXT);
  });
});
