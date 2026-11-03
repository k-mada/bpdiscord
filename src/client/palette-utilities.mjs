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

// Raw font-size and named-weight utilities; use a type-* role instead. Alignment
// (text-left/center/…), text-letterboxd-*, and font-sans/mono/letterboxdBody are excluded.
export const TYPOGRAPHY_UTILITY =
  "(?<![\\w])(?:text-(?:xs|sm|base|lg|xl|[2-9]xl)|" +
  "font-(?:thin|extralight|light|normal|medium|semibold|bold|extrabold|black))(?![\\w])";

// Raw spacing utilities with a numeric step; use a stack-*/cluster-*/pad-*/
// section-gap primitive instead. mx-auto, max-w-*, min-h-*, arbitrary values excluded.
export const SPACING_UTILITY =
  "(?<![\\w])(?:space-[xy]-[\\w.]+|gap(?:-[xy])?-[\\w.]+|[pm][trblxy]?-\\d[\\d.]*)";

// Tokens live in the @theme block in index.css, not a JS config; parse the
// --color-letterboxd-<name> declarations back into the test's { name: hex } shape.
/**
 * @param {string} cssText
 * @returns {Record<string, string>}
 */
export const readLetterboxdPalette = (cssText) => {
  /** @type {Record<string, string>} */
  const palette = {};
  const pattern = /--color-letterboxd-([a-z-]+):\s*([^;]+);/g;
  for (const [, name, value] of cssText.matchAll(pattern)) {
    palette[name] = value.trim();
  }
  return palette;
};
