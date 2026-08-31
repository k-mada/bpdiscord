import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";

// Raw Tailwind palette families. Colour must come from the letterboxd-* tokens
// so __tests__/palette.contrast.test.ts can actually gate every rendered pair.
const TAILWIND_PALETTE =
  "slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|" +
  "teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose";
const COLOUR_UTILITY =
  "(?:bg|text|border|ring|from|via|to|placeholder|divide|outline|decoration|" +
  `fill|stroke|caret|accent|shadow)-(?:${TAILWIND_PALETTE})-\\d{2,3}`;

const rawColourMessage =
  "Use a letterboxd-* colour token instead of a raw Tailwind palette colour. " +
  "Raw colours bypass the contrast gate in __tests__/palette.contrast.test.ts.";

// Severity-only override. A bare string would drop recommended's options, and
// several rules' schema defaults are far wider than what recommended sets.
const atSeverity = (severity) => (rule) => {
  const config = jsxA11y.flatConfigs.recommended.rules[rule];
  return [
    rule,
    Array.isArray(config) ? [severity, ...config.slice(1)] : severity,
  ];
};

// Every jsx-a11y rule is an error. No list of PROTECTED files: an unmatched
// flat-config `files` pattern is silent, so a rename downgraded one to `warn`.
const a11yErrors = Object.fromEntries(
  Object.keys(jsxA11y.flatConfigs.recommended.rules).map(atSeverity("error")),
);

// Defaults only inspect onMouseOver/onMouseOut; the hover-revealed content in
// this codebase uses onMouseEnter/onMouseLeave. Declared once, on purpose.
const MOUSE_EVENT_OPTIONS = {
  hoverInHandlers: ["onMouseOver", "onMouseEnter"],
  hoverOutHandlers: ["onMouseOut", "onMouseLeave"],
};

// Same two selectors at either severity: files cleaned by the burn-down are
// promoted to `error` so they cannot regress, the rest stay at `warn`.
const rawColour = (severity) => [
  severity,
  { selector: `Literal[value=/${COLOUR_UTILITY}/]`, message: rawColourMessage },
  {
    selector: `TemplateElement[value.raw=/${COLOUR_UTILITY}/]`,
    message: rawColourMessage,
  },
];

export default tseslint.config(
  { ignores: ["dist", "build", "coverage", "**/*.config.*"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs["recommended-latest"],
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.es2021 },
    },
    rules: {
      // TS owns undefined-name detection; the core rule misfires on globals
      // (vitest's describe/it/expect are used un-imported in tests).
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { args: "none", ignoreRestSiblings: true },
      ],
      "no-restricted-syntax": rawColour("warn"),
    },
  },
  {
    files: ["**/*.tsx"],
    ...jsxA11y.flatConfigs.recommended,
    rules: {
      ...a11yErrors,
      // Deprecated in favour of label-has-associated-control, which is also in
      // recommended; keeping both reports every label twice.
      "jsx-a11y/label-has-for": "off",
      "jsx-a11y/mouse-events-have-key-events": ["error", MOUSE_EVENT_OPTIONS],
    },
  },
  {
    // Not a promotion: both stay at `error`, options widened for one shape —
    // a focusable role="group" chart owning the arrow keys that move its readout.
    files: ["components/RatingDistributionHistogram.tsx"],
    rules: {
      "jsx-a11y/no-noninteractive-tabindex": [
        "error",
        { tags: [], roles: ["tabpanel", "group"], allowExpressionValues: true },
      ],
      "jsx-a11y/no-noninteractive-element-interactions": [
        "error",
        {
          handlers: [
            "onClick",
            "onError",
            "onLoad",
            "onMouseDown",
            "onMouseUp",
            "onKeyPress",
            "onKeyUp",
          ],
        },
      ],
    },
  },
  {
    // Inverted ratchet: raw colour is an error everywhere except the files the
    // burn-down has not reached, so new code starts protected by default.
    files: ["**/*.{ts,tsx}"],
    ignores: [
      "components/TasteCompatibility.tsx",
      "components/RatingDistributionHistogram.tsx",
      "components/MovieList.tsx",
      "components/UserProfile.tsx",
      // Unrouted and slated for deprecation — see bpdiscord-y6q.
      "components/HaterRankings.tsx",
    ],
    rules: { "no-restricted-syntax": rawColour("error") },
  },
);
