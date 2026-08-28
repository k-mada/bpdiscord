import tailwindConfig from "../tailwind.config.js";

// axe cannot evaluate contrast under jsdom, so the palette is measured straight
// from the tokens. Gates the palette, not its usage in components.

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

// accent stays legal as a fill, icon, or star but fails as body copy on
// bg-tertiary, so its surfaces are restricted rather than "all".
const foregroundPolicy: Record<string, "all" | string[]> = {
  ...Object.fromEntries(
    tokenNames.filter((k) => k.startsWith("text-")).map((k) => [k, "all"]),
  ),
  pro: "all",
  "link-hover": "all",
  error: "all",
  success: "all",
  warning: "all",
  info: "all",
  accent: ["bg-primary", "bg-secondary"],
};

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

// Pairings the line scanner cannot see: background on a wrapper, text in a
// child component. Semantics only — the colour still comes from the markup.
const composedPairings: Record<string, string[]> = {
  // oscars/PickCell wraps a title and subtitle in the winner tint
  "pro/10": ["text-primary", "text-muted"],
  // events/MyPicksPage highlights the selected nominee behind its label
  "pro/15": ["text-primary"],
};

// A translucent background is still a general ground; a translucent accent is
// decoration, so it claims only foregrounds it actually appears with.
const discoverOverlays = (): Overlay[] => {
  const bgPattern = /bg-letterboxd-((?:bg-)?[a-z-]+?)\/(\d{1,3})\b/;
  const fgPattern = /text-letterboxd-((?:bg-|text-)?[a-z-]+)\b/g;
  const found = new Map<string, Overlay>();

  // Per line, not per string literal: quote-matching misaligns in template
  // literals. A className wrapped across lines silently loses its pairing.
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

// Drives both the assertions and the snapshot, so the two cannot disagree.
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

const NAMED_GROUPS: Array<{ heading: string; tokens: string[] }> = [
  { heading: "Backgrounds", tokens: opaqueBackgrounds },
  {
    heading: "Text",
    tokens: tokenNames.filter((k) => k.startsWith("text-")),
  },
  { heading: "Accents", tokens: ["accent", "accent-hover", "pro", "link-hover"] },
  { heading: "Borders", tokens: ["border", "border-light"] },
];

// Trailing catch-all, so a token added to the config cannot go unrendered —
// THEME.md's alt text promises the swatch shows every one.
const grouped = new Set(NAMED_GROUPS.flatMap((g) => g.tokens));
const SWATCH_GROUPS = [
  ...NAMED_GROUPS,
  { heading: "States", tokens: tokenNames.filter((k) => !grouped.has(k)) },
].filter((g) => g.tokens.length > 0);

// Text tiers are drawn on each background; a hex list cannot show that.
const renderSwatchSvg = (): string => {
  const CHIP_W = 168;
  const CHIP_H = 56;
  const GAP = 12;
  const PAD = 24;
  const width = PAD * 2 + CHIP_W * 4 + GAP * 3;
  const parts: string[] = [];
  let y = PAD;

  const label = (text: string, x: number, ly: number, fill: string, size = 12, weight = 400) =>
    `<text x="${x}" y="${ly}" fill="${fill}" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="${size}" font-weight="${weight}">${text}</text>`;

  parts.push(`<rect width="${width}" height="100%" fill="${token("bg-primary")}"/>`);

  for (const { heading, tokens } of SWATCH_GROUPS) {
    y += 18;
    parts.push(label(heading.toUpperCase(), PAD, y, token("text-muted"), 11, 700));
    y += 14;
    tokens.forEach((name, i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = PAD + col * (CHIP_W + GAP);
      const cy = y + row * (CHIP_H + GAP + 30);
      parts.push(
        `<rect x="${x}" y="${cy}" width="${CHIP_W}" height="${CHIP_H}" rx="4" fill="${token(name)}" stroke="${token("border-light")}" stroke-width="1"/>`,
        label(name, x, cy + CHIP_H + 16, token("text-secondary"), 12, 600),
        label(token(name), x, cy + CHIP_H + 30, token("text-muted"), 11),
      );
    });
    const rows = Math.ceil(tokens.length / 4);
    y += rows * (CHIP_H + GAP + 30) + 12;
  }

  y += 18;
  parts.push(label("TEXT TIERS IN SITU", PAD, y, token("text-muted"), 11, 700));
  y += 12;

  const panelW = (width - PAD * 2 - GAP * 2) / 3;
  opaqueBackgrounds.forEach((bgName, i) => {
    const x = PAD + i * (panelW + GAP);
    parts.push(
      `<rect x="${x}" y="${y}" width="${panelW}" height="104" rx="4" fill="${token(bgName)}" stroke="${token("border")}" stroke-width="1"/>`,
      label(bgName, x + 12, y + 22, token("text-muted"), 10, 700),
    );
    ["text-primary", "text-secondary", "text-muted"].forEach((fg, j) => {
      parts.push(label(`${fg} sample`, x + 12, y + 46 + j * 20, token(fg), 13));
    });
  });
  y += 104 + PAD;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${y}" viewBox="0 0 ${width} ${y}" role="img" aria-label="BPDiscord letterboxd colour palette">`,
    ...parts,
    "</svg>",
    "",
  ].join("\n");
};

describe("letterboxd palette contrast (WCAG 2.2 AA)", () => {
  // Pins the derived matrix so coverage changes — especially coverage quietly
  // disappearing — show up in a diff.
  it("asserts this coverage matrix", () => {
    expect(renderCoverage()).toMatchInlineSnapshot(`
      "bg-primary
        accent, error, info, link-hover, pro, success, text-muted, text-primary, text-secondary, warning
      bg-secondary
        accent, error, info, link-hover, pro, success, text-muted, text-primary, text-secondary, warning
      bg-tertiary
        error, info, link-hover, pro, success, text-muted, text-primary, text-secondary, warning
      info-surface/20 over bg-primary
        info
      success-surface/20 over bg-primary
        success
      warning-surface/20 over bg-primary
        warning
      error-surface/20 over bg-primary
        error, text-primary
      bg-secondary/30 over bg-primary
        accent, error, info, link-hover, pro, success, text-muted, text-primary, text-secondary, warning
      bg-primary/50 over bg-primary
        accent, error, info, link-hover, pro, success, text-muted, text-primary, text-secondary, warning
      pro/20 over bg-primary
        pro
      pro/15 over bg-primary
        text-primary
      pro/10 over bg-primary
        text-muted, text-primary
      bg-primary/95 over bg-primary
        accent, error, info, link-hover, pro, success, text-muted, text-primary, text-secondary, warning"
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
      // ui/Input.tsx tints the border with `error` while aria-invalid is set.
      expect(
        contrast(token("error"), token("bg-secondary")),
      ).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });

    it("the focus outline meets 3:1 on every surface", () => {
      for (const { hex } of coverage) {
        expect(contrast(token("text-primary"), hex)).toBeGreaterThanOrEqual(
          AA_NON_TEXT,
        );
      }
    });

    // outline-offset is load-bearing: the indicator fails against the accent
    // and pro fills, and only passes because it sits clear of them.
    it("relies on outline-offset to clear the accent and pro fills", () => {
      expect(contrast(token("text-primary"), token("accent"))).toBeLessThan(
        AA_NON_TEXT,
      );
      expect(
        contrast(token("text-primary"), token("bg-primary")),
      ).toBeGreaterThanOrEqual(AA_NON_TEXT);
    });
  });

  // Embedded by THEME.md. Snapshotted so the picture cannot drift from the
  // tokens; regenerate with `yarn test -u`.
  it("renders the palette swatch embedded in THEME.md", async () => {
    await expect(renderSwatchSvg()).toMatchFileSnapshot("../palette.svg");
  });

  it("keeps text-secondary and text-muted visually distinct", () => {
    const ratio =
      relativeLuminance(token("text-secondary")) /
      relativeLuminance(token("text-muted"));
    expect(ratio).toBeGreaterThan(1.2);
  });
});
