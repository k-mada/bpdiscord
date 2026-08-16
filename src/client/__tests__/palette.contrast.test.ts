import tailwindConfig from "../tailwind.config.js";

/**
 * Contrast gate for the letterboxd-* palette (WCAG 2.2 AA).
 *
 * jsdom cannot evaluate colour contrast — axe needs real layout and computed
 * backgrounds — so this reads the tokens directly and does the maths. Without
 * it nothing in CI stops a palette edit from silently reintroducing a failure.
 *
 * The matrix is derived, not enumerated: backgrounds and foregrounds are
 * discovered by token naming, and translucent surfaces are discovered by
 * scanning the components that declare them. A new background token, text tier,
 * or `/NN` overlay is therefore covered the moment it is added, with no edit
 * here — and the alpha values cannot drift out of sync with the markup.
 *
 * This gates the palette, not its usage. Components can still reach for raw
 * Tailwind colours, which nothing here sees; that gap is closed by the
 * token-only lint rule tracked in bpdiscord-962.
 */

const AA_TEXT = 4.5;
const AA_NON_TEXT = 3.0;

const palette = (
  tailwindConfig as {
    theme: { extend: { colors: { letterboxd: Record<string, string> } } };
  }
).theme.extend.colors.letterboxd;

const token = (name: string): string => {
  const value = palette[name];
  if (!value) throw new Error(`Unknown palette token: ${name}`);
  return value;
};

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
  return toHex({ r: mix(f.r, b.r), g: mix(f.g, b.g), b: mix(f.b, b.b) });
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

const tokenNames = Object.keys(palette);
const opaqueBackgrounds = tokenNames.filter((k) => k.startsWith("bg-"));

/**
 * Foreground tokens and the backgrounds they are allowed on. "all" is the
 * default; the exception encodes a real design constraint that cannot be
 * derived from the values — `accent` is a brand colour that stays legal as a
 * fill, an icon, or a star, but measures 4.14:1 as body copy on bg-tertiary,
 * so that surface must use text-primary instead.
 */
const foregroundPolicy: Record<string, "all" | string[]> = {
  ...Object.fromEntries(
    tokenNames.filter((k) => k.startsWith("text-")).map((k) => [k, "all"]),
  ),
  pro: "all",
  "link-hover": "all",
  accent: ["bg-primary", "bg-secondary"],
};

/**
 * Translucent surfaces, read from the markup that declares them rather than
 * copied here — e.g. the Oscars row striping and winner tint.
 *
 * They are composited over bg-primary because that is the app's actual ground:
 * MainLayout paints it and `.card` is padding only, contributing no background
 * of its own. Modelling every opaque token as a possible ground instead would
 * assert combinations that never render. An overlay nested over some other
 * surface is a case only the browser axe pass (bpdiscord-962) can see.
 */
const sources: Record<string, string> = {
  ...(import.meta.glob("../components/**/*.tsx", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>),
  // index.css declares utilities in the same class vocabulary
  ...(import.meta.glob("../index.css", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>),
};

interface Overlay {
  label: string;
  hex: string;
  foregrounds: string[];
}

/**
 * Parent/child pairings the scanner cannot see, because the background sits on
 * a wrapper and the text on a child component. Only the semantics are declared
 * here — the alpha and the resulting colour still come from the markup, so
 * these cannot drift the way a hardcoded surface value would.
 */
const composedPairings: Record<string, string[]> = {
  // oscars/PickCell wraps a title and subtitle in the winner tint
  "pro/10": ["text-primary", "text-muted"],
  // events/MyPicksPage highlights the selected nominee behind its label
  "pro/15": ["text-primary"],
};

/**
 * A translucent *background* token is still a general ground, so it inherits
 * the full foreground cross-product. A translucent accent is a localized
 * decoration: asserting the same cross-product there would invent pairings that
 * never render — the TasteCompatibility tick marks are 1px rules carrying no
 * text at all. Those assert only the foregrounds found in the same className,
 * plus any declared above.
 */
const discoverOverlays = (): Overlay[] => {
  const bgPattern = /bg-letterboxd-((?:bg-)?[a-z-]+?)\/(\d{1,3})\b/;
  const fgPattern = /text-letterboxd-((?:bg-|text-)?[a-z-]+)\b/g;
  const found = new Map<string, Overlay>();

  // Scanned per line rather than per string literal: className values are
  // line-local here, and quote-matching misaligns inside template literals.
  // Caveat: a className wrapped so that a translucent accent and its text token
  // land on different lines loses that pairing — silently, since nothing turns
  // red. The snapshot above is what surfaces it, as a removed assertion.
  for (const source of Object.values(sources)) {
    for (const segment of source.split("\n")) {
      const bg = bgPattern.exec(segment);
      if (!bg?.[1] || !bg[2]) continue;
      const value = palette[bg[1]];
      if (!value) continue;

      const key = `${bg[1]}/${bg[2]}`;
      const label = `${key} over bg-primary`;
      const isGround = bg[1].startsWith("bg-");
      const entry = found.get(label) ?? {
        label,
        hex: composite(value, token("bg-primary"), Number(bg[2]) / 100),
        foregrounds: isGround
          ? Object.keys(foregroundPolicy)
          : [...(composedPairings[key] ?? [])],
      };
      for (const [, fg] of segment.matchAll(fgPattern)) {
        if (fg && palette[fg] && !entry.foregrounds.includes(fg)) {
          entry.foregrounds.push(fg);
        }
      }
      found.set(label, entry);
    }
  }
  return [...found.values()];
};

const allowedOn = (fg: string, backgroundName: string): boolean => {
  const policy = foregroundPolicy[fg];
  if (policy === "all") return true;
  if (!policy) return false;
  // A translucent surface inherits the policy of the ground it sits over.
  return policy.some((allowed) => backgroundName.includes(allowed));
};

/** Every surface/foreground pair this file asserts. Drives both the tests and
 *  the inline snapshot below, so the two can never disagree. */
const coverage: Overlay[] = [
  ...opaqueBackgrounds.map((name) => ({
    label: name,
    hex: token(name),
    foregrounds: Object.keys(foregroundPolicy).filter((fg) =>
      allowedOn(fg, name),
    ),
  })),
  ...discoverOverlays().filter((o) => o.foregrounds.length > 0),
];

const renderCoverage = () =>
  coverage
    .map(({ label, foregrounds }) => `${label}\n  ${[...foregrounds].sort().join(", ")}`)
    .join("\n");

describe("letterboxd palette contrast (WCAG 2.2 AA)", () => {
  /**
   * The matrix is derived, so it cannot be read off the source. This pins it in
   * a form that shows up in a diff: adding a token or an overlay appears as
   * added assertions, and — more importantly — coverage quietly disappearing
   * (a renamed class, a className wrapped across lines) appears as a removal.
   */
  it("asserts this coverage matrix", () => {
    expect(renderCoverage()).toMatchInlineSnapshot(`
      "bg-primary
        accent, link-hover, pro, text-muted, text-primary, text-secondary
      bg-secondary
        accent, link-hover, pro, text-muted, text-primary, text-secondary
      bg-tertiary
        link-hover, pro, text-muted, text-primary, text-secondary
      bg-secondary/30 over bg-primary
        accent, link-hover, pro, text-muted, text-primary, text-secondary
      bg-primary/50 over bg-primary
        accent, link-hover, pro, text-muted, text-primary, text-secondary
      pro/20 over bg-primary
        pro
      pro/15 over bg-primary
        text-primary
      pro/10 over bg-primary
        text-muted, text-primary
      bg-primary/95 over bg-primary
        accent, link-hover, pro, text-muted, text-primary, text-secondary"
    `);
  });

  describe.each(coverage)("on $label", ({ hex, foregrounds }) => {
    it.each(foregrounds)("%s meets 4.5:1", (fg) => {
      expect(contrast(token(fg), hex)).toBeGreaterThanOrEqual(AA_TEXT);
    });
  });

  describe("fills used as backgrounds", () => {
    it("btn-primary's black label passes on accent and its hover", () => {
      expect(contrast("#000000", token("accent"))).toBeGreaterThanOrEqual(AA_TEXT);
      expect(contrast("#000000", token("accent-hover"))).toBeGreaterThanOrEqual(
        AA_TEXT,
      );
    });

    it("the active Oscars toggle passes on the pro fill", () => {
      expect(contrast(token("bg-primary"), token("pro"))).toBeGreaterThanOrEqual(
        AA_TEXT,
      );
    });
  });

  describe("non-text contrast (1.4.11)", () => {
    it("control borders meet 3:1 against the field background", () => {
      expect(
        contrast(token("border-light"), token("bg-secondary")),
      ).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });

    it("the invalid-field border stays distinguishable", () => {
      // Tailwind red-500, applied by ui/Input.tsx via aria-invalid:border-red-500
      expect(contrast("#ef4444", token("bg-secondary"))).toBeGreaterThanOrEqual(
        AA_NON_TEXT,
      );
    });

    it("the focus outline meets 3:1 on every surface", () => {
      for (const { hex } of coverage) {
        expect(contrast(token("text-primary"), hex)).toBeGreaterThanOrEqual(
          AA_NON_TEXT,
        );
      }
    });

    /**
     * The outline sits 2px clear of the element, so it is measured against the
     * page rather than the fill it surrounds. That offset is load-bearing:
     * text-primary is only 2.30:1 on the accent fill and 1.23:1 on pro, so
     * removing `outline-offset` would fail 1.4.11 on every primary button.
     */
    it("relies on outline-offset to clear the accent and pro fills", () => {
      expect(contrast(token("text-primary"), token("accent"))).toBeLessThan(
        AA_NON_TEXT,
      );
      expect(
        contrast(token("text-primary"), token("bg-primary")),
      ).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });
  });

  it("keeps text-secondary and text-muted visually distinct", () => {
    const ratio =
      relativeLuminance(token("text-secondary")) /
      relativeLuminance(token("text-muted"));
    expect(ratio).toBeGreaterThan(1.2);
  });
});
