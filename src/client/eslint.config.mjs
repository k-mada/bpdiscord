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
  return [rule, Array.isArray(config) ? [severity, ...config.slice(1)] : severity];
};

// jsx-a11y and the colour rule land at `warn` so pre-existing findings do not
// block; each follow-up promotes the rules covering its own files to `error`.
const a11yWarnings = Object.fromEntries(
  Object.keys(jsxA11y.flatConfigs.recommended.rules).map(atSeverity("warn")),
);

const a11yErrors = (...rules) =>
  Object.fromEntries(rules.map(atSeverity("error")));

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
      "no-restricted-syntax": [
        "warn",
        {
          selector: `Literal[value=/${COLOUR_UTILITY}/]`,
          message: rawColourMessage,
        },
        {
          selector: `TemplateElement[value.raw=/${COLOUR_UTILITY}/]`,
          message: rawColourMessage,
        },
      ],
    },
  },
  {
    files: ["**/*.tsx"],
    ...jsxA11y.flatConfigs.recommended,
    rules: {
      ...a11yWarnings,
      // Deprecated in favour of label-has-associated-control, which is also in
      // recommended; keeping both reports every label twice.
      "jsx-a11y/label-has-for": "off",
      // Defaults only inspect onMouseOver/onMouseOut; the hover-only
      // disclosures in this codebase use onMouseEnter/onMouseLeave.
      "jsx-a11y/mouse-events-have-key-events": [
        "warn",
        {
          hoverInHandlers: ["onMouseOver", "onMouseEnter"],
          hoverOutHandlers: ["onMouseOut", "onMouseLeave"],
        },
      ],
    },
  },
  {
    // Remediated files hold their rules at error so they cannot regress.
    files: [
      "components/Modal.tsx",
      "components/HaterRankings2.tsx",
      "components/*/NomineesModal.tsx",
    ],
    rules: a11yErrors(
      "jsx-a11y/click-events-have-key-events",
      "jsx-a11y/no-static-element-interactions",
      "jsx-a11y/no-noninteractive-element-interactions",
    ),
  },
  {
    files: [
      "components/Tooltip.tsx",
      "components/TasteCompatibility.tsx",
      "components/RatingDistributionHistogram.tsx",
    ],
    rules: {
      ...a11yErrors(
        "jsx-a11y/no-noninteractive-tabindex",
        "jsx-a11y/no-static-element-interactions",
        "jsx-a11y/click-events-have-key-events",
      ),
      "jsx-a11y/mouse-events-have-key-events": [
        "error",
        {
          hoverInHandlers: ["onMouseOver", "onMouseEnter"],
          hoverOutHandlers: ["onMouseOut", "onMouseLeave"],
        },
      ],
    },
  },
  {
    files: [
      "components/ActorGraph.tsx",
      "components/CompareWithUser.tsx",
      "components/MovieSwapPage.tsx",
      "components/UserComparison.tsx",
      "components/MovieFantasyLeague/MovieSelector.tsx",
      "components/events/CreateEventForm.tsx",
    ],
    rules: a11yErrors(
      "jsx-a11y/label-has-associated-control",
      "jsx-a11y/role-supports-aria-props",
      "jsx-a11y/role-has-required-aria-props",
    ),
  },
);
