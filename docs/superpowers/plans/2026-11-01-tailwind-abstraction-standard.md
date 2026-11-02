# Tailwind Abstraction Standard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move color, typography, and spacing decisions out of `.tsx` markup into named semantic CSS classes, gated by lint, migrated in small visually-no-op PRs.

**Architecture:** Extend the repo's existing `@utility` pattern in `src/client/index.css`. First unify theme config into a CSS-first `@theme` block (deleting `tailwind.config.js`), then add `type-*` typography roles and `stack-*`/`cluster-*`/`pad-*`/`section-gap` spacing primitives, finish the color burn-down, and convert markup route-by-route. Three `no-restricted-syntax` ESLint rules enforce the ban, each raised to `error` only after its category's burn-down lands so CI never breaks mid-migration.

**Tech Stack:** React 19 + Vite, Tailwind CSS v4.3.1 (CSS-first `@theme`), Vitest, ESLint flat config (`typescript-eslint`, `no-restricted-syntax`).

**Spec:** `docs/superpowers/specs/2026-11-01-tailwind-abstraction-standard-design.md`

## Global Constraints

- Tailwind stays on v4.3.1 — no version bump; the config *form* changes (JS → CSS `@theme`), utility class names are preserved. (Spec §3, §4.4)
- Every PR is a visual no-op; a screenshot or the e2e suite proves it. (Spec §8)
- PR size ceiling: ~10 files / 400 added lines (AGENTS.md). Phase 3/4 split **by page/route**. (Spec §8, §10)
- Semantic class names are fixed: `type-display|h1|h2|h3|body|body-sm|body-strong|prose|caption|label`; spacing `stack-sm|md|lg`, `cluster-sm|md`, `pad-card`, `pad-control`, `section-gap`. (Spec §5.1, §5.2, §9)
- `type-*` carries size + line-height + weight + family, **never color**. (Spec §5.1)
- `stack-*` is flex-column + `gap`, never `space-y`. Padding primitives are `pad-*`, never `inset-*`. Responsive type uses `clamp()` inside the role, never `md:` in markup. (Spec §10)
- Color vocabulary stays the existing `letterboxd-*` tokens; no new color aliases. (Spec §5.3, §9)
- Spacing scale locked to 5 steps: `xs` 0.25rem, `sm` 0.5rem, `md` 1rem, `lg` 1.5rem, `xl` 2rem. (Spec §5.2)
- Lint ban is explicit token enumeration, not a prefix match (`text-` is overloaded). Allowed: `text-left|center|right|justify`, `text-letterboxd-*`, layout/box utilities, variants. (Spec §6)
- Keep `tailwind-merge`; Stylelint config unchanged. (Spec §7)
- Git: never commit to `main`; feature branch → PR; PR body ≤200 words per `.github/pull_request_template.md`. Comment ceiling: ≤2 consecutive non-JSDoc comment lines. (AGENTS.md)

## Review Focus

- **Exactly-768px viewport (`max-md:`):** old config's `{max:"768px"}` is inclusive at 768; v4 native `max-md:` is exclusive (`<48rem`). At exactly 768px, `max-md:` styles no longer apply and `md:` wins. Verified single-pixel edge; spec settled on native. Confirm the 12 `max-md:` sites read acceptably at the `md` boundary. (Phase 0)
- **Line-height drop on type roles:** a `type-*` role that sets only `font-size` silently loses the paired line-height Tailwind's `text-*` carried. Each `type-*` must set `line-height`. (Phase 1)
- **Dynamic classNames invisible to lint:** `cn()`/`clsx()`/template-literal classes are not seen by `no-restricted-syntax`; green CI is not proof of zero raw classes. Rule also inspects string-literal args to `cn()`/`clsx()`; the rest is a review responsibility. (Phase 1)
- **`space-y` → `stack-*` with conditional/wrapping children:** `space-y`'s owl selector and flex-`gap` differ when children wrap or render conditionally; converting a `space-y` container that relied on owl-selector behavior can shift rhythm. Screenshot each route. (Phase 4)
- **Folded utilities (`subheading`, `section-title`, `table-heading-row`):** these absorb into `type-*`; every existing consumer must map to the right `type-*` + retained decoration (e.g. `subheading`'s bottom rule) or visuals shift. (Phase 3)

---

### Task 0: CSS-first config migration (Phase 0) — **EXECUTED IN THIS SESSION**

Move every value from `tailwind.config.js` into an `@theme` block in `index.css`, delete the JS file and the `@config` directive, re-point the contrast test, swap the 3 `theme()` calls. Visual + markup no-op. Commit the design spec to `docs/superpowers/specs/`.

**Files:**
- Modify: `src/client/index.css` (add `@theme` block; delete `@config` line 3; swap 3 `theme()` calls to `var(--color-*)`; move `@keyframes`/animation into theme)
- Delete: `src/client/tailwind.config.js`
- Modify: `src/client/__tests__/palette.contrast.test.ts` (drop JS import; read palette from `@theme` via helper)
- Modify: `src/client/palette-utilities.mjs` (add `readLetterboxdPalette(cssText)` helper)
- Modify: `src/client/THEME.md` (3 refs: `tailwind.config.js` → `@theme` block in `index.css`)
- Regenerate: `src/client/palette.svg` (via `yarn test -u`; diff expected empty/whitespace)
- Create: `docs/superpowers/specs/2026-11-01-tailwind-abstraction-standard-design.md` (the approved spec)

**Interfaces:**
- Produces: `@theme` block is the single source of truth for `--color-letterboxd-*` token values. `palette-utilities.mjs` exports `readLetterboxdPalette(cssText: string): Record<string,string>` parsing `--color-letterboxd-<name>: <hex>;` into `{ "<name>": "<hex>" }` (keys without the `--color-letterboxd-` prefix, matching the old `palette` shape).

- [x] **Step 1 — Baseline:** run `yarn build`, `yarn lint`, `yarn test:lite` on current tree; capture pass/fail so the no-op is provable.
- [x] **Step 2 — `@theme` migration:** add `@theme { --color-letterboxd-*; --font-sans; --font-letterboxdBody; --radius-xl; --radius-2xl; --shadow-letterboxd; --shadow-letterboxd-lg; --animate-fade-in; --animate-slide-up; }` to `index.css`. Keep `--font-letterboxdBody` camelCase. Delete fontSize (all 8 = v4 default — verified), `screens.max-*` (v4 native `max-md:` from `--breakpoint-md: 48rem` — verified), `spacing 18/88`, `zIndex:1`, `content`. Keep the `@keyframes fadeIn`/`slideUp` the animations reference. Delete `@config` line.
- [x] **Step 3 — swap `theme()` calls:** 3 calls in `index.css` → `var(--color-letterboxd-text-primary|bg-secondary|border)`.
- [x] **Step 4 — delete** `tailwind.config.js`.
- [x] **Step 5 — re-point test:** `palette-utilities.mjs` gets `readLetterboxdPalette`; test reads `index.css` from disk and parses the `@theme` block instead of importing the JS config.
- [x] **Step 6 — update** `THEME.md` 3 refs.
- [x] **Step 7 — verify:** `yarn build` passes, `yarn lint` passes, contrast test passes, `yarn test -u` leaves `palette.svg` unchanged (git diff empty/whitespace), before/after visual check shows no change.
- [x] **Step 8 — commit the spec** to `docs/superpowers/specs/` and open the PR.

### Task 1: Foundations — type + spacing tokens, lint rules at warn (Phase 1)

Add every `type-*` role and spacing primitive to `index.css` and the three lint rules at `warn`. No markup changed, so this is provably a no-op by inspection + build.

**Files:**
- Modify: `src/client/index.css` (add `@utility type-*` and spacing primitives; add spacing scale vars to `@theme` if used by primitives)
- Modify: `src/client/eslint.config.mjs` (3 `no-restricted-syntax` rules at `warn`)
- Modify: `src/client/palette-utilities.mjs` (optional: export banned-token lists shared by the rules, mirroring `COLOUR_UTILITY`)
- Test: `src/client/__tests__/*` — a lint-rule smoke test if the repo has a pattern for it; otherwise rely on `yarn lint` output

**Interfaces:**
- Produces: CSS classes `type-display|h1|h2|h3|body|body-sm|body-strong|prose|caption|label`; `stack-sm|md|lg`, `cluster-sm|md`, `pad-card`, `pad-control`, `section-gap` — exact bundles from spec §5.1/§5.2 tables. ESLint rules keyed to banned tokens from spec §6, each message naming the semantic replacement.

- [ ] **Step 1:** add `type-*` utilities to `index.css` — each sets `font-size`, `line-height`, `font-weight`, `font-family` per §5.1; `type-display` uses `clamp(2.25rem, …, 3rem)`; `type-prose`/`type-h*` family split (Be Vietnam Pro vs PT Serif). No color.
- [ ] **Step 2:** add spacing primitives per §5.2 — `stack-*` = `display:flex;flex-direction:column;gap:<sm|md|xl>`; `cluster-*` = flex `gap`; `pad-card`/`pad-control`; `section-gap` = `margin-block-end`.
- [ ] **Step 3:** add the 3 `no-restricted-syntax` rules at `warn`, each with a message pointing at the semantic class; also inspect string-literal args to `cn()`/`clsx()`.
- [ ] **Step 4:** `yarn lint` (warnings only, exit 0), `yarn build`, `yarn test:lite` pass. Commit.

### Task 2: Color finish (Phase 2)

Convert the ~34 raw palette hits in `.tsx` to the nearest `letterboxd-*` token; raise the color rule to `error`. Contrast test gates each converted pair automatically.

**Files:**
- Modify: the `.tsx` files carrying the 34 raw palette hits (enumerate via `grep -rnE "$COLOUR_UTILITY" src/client/components`)
- Modify: `src/client/eslint.config.mjs` (color rule `warn` → `error`)

**Interfaces:**
- Consumes: `letterboxd-*` tokens from the `@theme` block (Task 0); contrast test from Task 0.

- [ ] **Step 1:** enumerate the raw-palette hits; map each to the nearest token (add a `composedPairings`/snapshot entry in the contrast test if a new surface/foreground pair appears).
- [ ] **Step 2:** convert; run `yarn test` (contrast matrix + snapshot) and screenshot affected surfaces.
- [ ] **Step 3:** raise color rule to `error`; `yarn lint` passes. Commit. (Split into ≤10-file PRs if the hit set is large.)

### Task 3: Typography migration (Phase 3 — several PRs, one per route)

Per route, replace inline `text-*`/`font-*` with `type-*`; fold `subheading`/`section-title`/`table-heading-row` into the `type-*` set. Raise the type rule to `error` when the last route lands.

**Files (per route PR):**
- Modify: the route's component tree under `src/client/components/**`
- Modify (last PR only): `src/client/eslint.config.mjs` (type rule → `error`); remove folded utilities from `index.css` once no consumer remains

**Interfaces:**
- Consumes: `type-*` classes (Task 1).

- [ ] **Per route:** replace inline size/weight with `type-*`; map `subheading` → `type-h2` + retained bottom rule, `section-title` → `type-h2`/uppercase variant, `table-heading-row` → `type-label`. Screenshot before/after. Commit one route per PR.
- [ ] **Last PR:** delete folded utilities with zero remaining consumers; raise type rule to `error`; update AGENTS.md "Code style" with the type vocabulary (Phase 5 fold).

### Task 4: Spacing migration (Phase 4 — several PRs, one per route)

Per route, replace inline spacing with primitives. Watch `space-y` → `stack-*` on conditional/wrapping children. Raise the spacing rule to `error` when done.

**Files (per route PR):**
- Modify: the route's component tree
- Modify (last PR only): `src/client/eslint.config.mjs` (spacing rule → `error`)

**Interfaces:**
- Consumes: spacing primitives (Task 1).

- [ ] **Per route:** replace `space-y-*`→`stack-*`, `gap-*`→`cluster-*`, `p-4`→`pad-card`, `px-4 py-3`→`pad-control`, `mb-6/8`→`section-gap`; page padding stays in `main-content`. Screenshot. Commit per route.
- [ ] **Last PR:** raise spacing rule to `error`; AGENTS.md "Code style" spacing vocabulary (Phase 5 fold).

### Task 5: Docs sync (Phase 5 — folded into the last PR of each phase)

Update AGENTS.md "Code style" with the semantic vocabulary and the banned-class rule, per the repo keep-in-sync requirement. (Phase 0 already handled the config-location docs in `THEME.md`; AGENTS.md never names `tailwind.config.js`.)

- [ ] Folded into Task 3's and Task 4's final PRs — no standalone PR.
