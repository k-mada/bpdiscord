// Raw Tailwind palette families. Colour must come from the letterboxd-* tokens
// so __tests__/palette.contrast.test.ts can gate every rendered pair. Shared by
// eslint.config.mjs (TS/TSX literals) and the test (index.css) so the two gates
// enforce the same vocabulary and cannot drift.
export const TAILWIND_PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|" +
  "teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";

export const COLOUR_UTILITY =
  "(?:bg|text|border|ring|from|via|to|placeholder|divide|outline|decoration|" +
  `fill|stroke|caret|accent|shadow)-(?:${TAILWIND_PALETTE})-\\d{2,3}`;
