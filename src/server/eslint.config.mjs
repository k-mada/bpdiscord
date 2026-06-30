import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";

export default tseslint.config(
  { ignores: ["dist", "coverage"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2021 },
    },
    rules: {
      // TS owns undefined-name detection; the core rule misfires on globals
      // (vitest's describe/it/expect are used un-imported in tests).
      "no-undef": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow the Express Request / NodeJS ProcessEnv augmentations in types.ts.
      "@typescript-eslint/no-namespace": ["error", { allowDeclarations: true }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        { args: "none", ignoreRestSiblings: true },
      ],
    },
  },
);
