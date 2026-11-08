import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import jsxA11y from "eslint-plugin-jsx-a11y";
import globals from "globals";
import {
  COLOUR_UTILITY,
  TYPOGRAPHY_UTILITY,
  SPACING_UTILITY,
} from "./palette-utilities.mjs";

const rawColourMessage =
  "Use a letterboxd-* colour token instead of a raw Tailwind palette colour. " +
  "Raw colours bypass the contrast gate in __tests__/palette.contrast.test.ts.";

const typographyMessage =
  "Use a type-* role class (type-h2, type-body, type-caption, …) instead of a raw " +
  "Tailwind font-size/weight utility. See src/client/THEME.md.";

const spacingMessage =
  "Use a spacing primitive (stack-*, cluster-*, pad-card, pad-control, section-gap) " +
  "instead of a raw Tailwind spacing utility. See src/client/THEME.md.";

// Separate rules because no-restricted-syntax has one severity for all its
// selectors, but colour is already error while type/spacing must stay warn.
const classScanRule = (pattern, message) => ({
  meta: { type: "suggestion", schema: [] },
  create(context) {
    const re = new RegExp(pattern);
    const report = (node, text) => {
      if (typeof text === "string" && re.test(text)) {
        context.report({ node, message });
      }
    };
    return {
      Literal: (node) => report(node, node.value),
      TemplateElement: (node) => report(node, node.value.raw),
    };
  },
});

const tailwindBan = {
  rules: {
    "no-raw-typography": classScanRule(TYPOGRAPHY_UTILITY, typographyMessage),
    "no-raw-spacing": classScanRule(SPACING_UTILITY, spacingMessage),
  },
};

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

// Raw palette colours are banned everywhere; the burn-down is complete.
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
    plugins: { "tailwind-ban": tailwindBan },
    rules: {
      // TS owns undefined-name detection; the core rule misfires on globals
      // (vitest's describe/it/expect are used un-imported in tests).
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { args: "none", ignoreRestSiblings: true },
      ],
      "no-restricted-syntax": rawColour("error"),
      // Typography burn-down is complete (Phase 3); spacing stays warn until Phase 4.
      "tailwind-ban/no-raw-typography": "error",
      "tailwind-ban/no-raw-spacing": "warn",
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
);
