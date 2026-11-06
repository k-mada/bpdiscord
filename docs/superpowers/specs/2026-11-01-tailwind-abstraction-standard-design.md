# Tailwind Abstraction Standard — Design

Date: 2026-11-01
Status: DRAFT — awaiting approval. No code changes until approved.
Repo: bpdiscord (client: `src/client`)

## 1. Intent and why

Components set color, type, and spacing with raw Tailwind classes inline.
To restyle one role, an engineer edits the same values in many files and
misses some. This standard moves those three decisions out of markup and
into named, semantic classes. Change a role in one place. Every component
follows.

The repo already proves the pattern. `src/client/index.css` holds semantic
component classes (`.card`, `input-field`, `subheading`, `section-title`,
`table-heading-row`). This standard extends that same `@utility` pattern to
typography and spacing, and finishes the color job that is nearly done.

## 2. Current state (measured 2026-11-01)

- Color: 1,117 `letterboxd-*` token hits against 34 raw palette hits
  (`bg-slate-800`, `bg-green-800`, etc.). Color is ~97% abstracted. The
  value lives in `tailwind.config.js`. Only the 34 stragglers are debt.
- Typography: 9 font sizes and 4 weights, chosen inline at ~500 sites
  (`text-sm`×222, `text-xs`×82, `text-xl`×52, `font-bold`×108). No role
  layer exists.
- Spacing: dozens of raw values inline (`mb-4`×100, `px-4`×98, `gap-2`×56,
  `space-y-4`×24). No semantic scale exists.

Conclusion: color is a lock-and-finish job. Typography and spacing are the
real gaps and the source of the restyle pain.

## 3. Goals, non-goals, anti-goals

Goals
- One semantic name per visual role for type, spacing, and color.
- Markup stops naming color, type, and spacing primitives.
- A lint gate stops the standard from rotting.
- Migrate in small, reviewable PRs (AGENTS.md: ~10 files / 400 lines each).

Non-goals
- No visual redesign. Output must look the same after each PR.
- No change to layout utilities (`flex`, `grid`, `relative`, `w-full`).
- No React primitive components. (Decision: CSS `@utility` classes.)
- No Tailwind version change. The repo is already on v4.3.x. The *config
  form* does change — `tailwind.config.js` → CSS-first `@theme` — but that
  is a refactor within v4, not a version bump (see Phase 0).

Anti-goals (these mean the project failed even if it "works")
- A semantic vocabulary so large nobody remembers it.
- A migration PR big enough that review is rubber-stamped.
- A lint rule flipped to error before its category is converted, which
  breaks CI mid-migration and blocks unrelated work.

## 4. Locked decisions

1. Mechanism: CSS `@utility` semantic classes in `index.css`. Markup uses
   `className="type-h2 stack-md"`, never `text-xl font-semibold space-y-4`.
2. Scope: pragmatic. Ban color, typography, and spacing primitives in
   `.tsx`. Keep layout utilities in markup.
3. Enforcement: lint at error, phased. Raise each ESLint rule to error only
   after that category's burn-down lands, so CI never breaks mid-migration.
4. Config form: CSS-first. All theme values move from `tailwind.config.js`
   into an `@theme` block in `index.css`, and the JS config file is deleted.
   This lands first (Phase 0) so every later phase extends one `@theme`
   block instead of straddling JS config (colors) and CSS (new type/spacing
   tokens). Utility class names are preserved, so it is a visual + markup
   no-op.

## 5. The standard

### 5.1 Typography — role classes

Each class bundles size, weight, and font-family so a role is one token.
Family follows the existing split: headings and UI chrome use Be Vietnam
Pro; long-form prose uses PT Serif.

| Class | Bundles | Replaces inline | Role |
|---|---|---|---|
| `type-display` | `clamp(2.25rem, …, 3rem)`, bold, sans | `text-4xl/5xl font-bold` | hero, movie counter |
| `type-h1` | 1.5rem, semibold, sans | `text-2xl font-semibold` | page title |
| `type-h2` | 1.25rem, semibold, sans | `text-xl font-semibold` | section head (absorbs `subheading`, `section-title`) |
| `type-h3` | 1.125rem, semibold, sans | `text-lg font-semibold` | card title |
| `type-body` | 1rem, normal, sans | `text-base font-normal` | default UI text |
| `type-body-sm` | 0.875rem, normal, sans | `text-sm` | dense rows, secondary text |
| `type-body-strong` | 0.875rem, medium, sans | `text-sm font-medium` | emphasized row text |
| `type-prose` | 1.2rem, normal, serif | `.body-text.-prose` | long-form reading |
| `type-caption` | 0.75rem, normal, sans | `text-xs` | metadata, counts |
| `type-label` | 0.75rem, medium, uppercase, tracked, sans | `text-xs font-medium uppercase tracking-wider` | table headers (absorbs `table-heading-row`) |

Notes:
- `type-*` sets `font-size`, `line-height`, `font-weight`, and
  `font-family`. It owns line-height deliberately — a role that set only
  `font-size` would silently drop the paired line-height that Tailwind's
  `text-*` utilities carry. Color is **not** included, so a caption can be
  primary or muted without a new type role.
- Any role with a responsive step (`type-display`'s `4xl`→`5xl`) expresses
  it with `clamp()` inside the class, not a `md:` variant in markup. One
  role, one class, no breakpoint in the call site. (Decision 2026-11-01.)

### 5.2 Spacing — restricted scale plus intent primitives

Lock the scale to five steps. Current usage already clusters here.

| Step | Value |
|---|---|
| `xs` | 0.25rem |
| `sm` | 0.5rem |
| `md` | 1rem |
| `lg` | 1.5rem |
| `xl` | 2rem |

Expose intent, not numbers:

| Primitive | Implements | Replaces | Role |
|---|---|---|---|
| `stack-sm` / `stack-md` / `stack-lg` | `display:flex; flex-direction:column; gap` at sm/md/xl | `space-y-2/4/8` | rhythm between stacked children |
| `cluster-sm` / `cluster-md` | flex `gap` at sm/md | `gap-2/4` | gaps in a flex/grid row |
| `pad-card` | padding md | `p-4` | card interior |
| `pad-control` | padding `px md py` ~0.75rem | `px-4 py-3` | input and button interior |
| `section-gap` | margin-block-end lg/xl | `mb-6/mb-8` | gap under a section block |

`stack-*` uses flex-column + `gap`, **not** `space-y` (the owl selector
`> * + *`): `gap` is robust with wrapping and conditional children and is
symmetric with `cluster-*`. (Decision 2026-11-01.) The padding primitives
are `pad-*`, **not** `inset-*`, to avoid colliding with Tailwind's core
`inset-*` positioning utilities (`inset-0`, `inset-x-4`). (Decision
2026-11-01.)

Outliers: page-level vertical padding (`py-8`, `py-12`) belongs to the
existing `main-content` utility, not to markup. Any spacing value outside
the scale is a smell — route it through a primitive or justify it in review.

### 5.3 Color — finish and lock

- Keep the `letterboxd-*` tokens as the color vocabulary. After Phase 0 they
  live in the `@theme` block in `index.css` (not `tailwind.config.js`), still
  centralized, utility names unchanged. No new color aliases. (Builder call.)
- The `@theme` block in `index.css` is the single source of truth for token
  values after Phase 0. Nothing imports the values from JS anymore.
- Burn down the 34 raw palette hits to the nearest `letterboxd-*` token.
  The palette contrast test (`src/client/__tests__/palette.contrast.test.ts`)
  gates every token pairing, so converted colors are checked automatically.
  Phase 0 re-points this test off the deleted JS config onto the `@theme`
  tokens — do that burn-down after Phase 0 so the gate is intact.
- Then raise the existing `no-restricted-syntax` color rule in
  `src/client/eslint.config.mjs` from warn to error.

### 5.4 CSS-first config migration (Phase 0)

Move every value out of `tailwind.config.js` into an `@theme` block in
`index.css`, delete the JS file, and drop the `@config` directive
(`index.css:3`). v4 generates the same utility names from `@theme`
variables, so markup does not change — this is a no-op refactor that
unifies where theme values live before the standard adds to them.

Mapping (measured 2026-11-01):

| JS config block | CSS-first form | Action / note |
|---|---|---|
| `colors.letterboxd.*` (20) | `@theme { --color-letterboxd-bg-primary: #14181c; … }` | mechanical; `bg-letterboxd-*` names unchanged |
| `fontFamily.sans` | `--font-sans: …` | unchanged class `font-sans` |
| `fontFamily.letterboxdBody` | `--font-letterboxdBody: …` | **keep camelCase var** so `font-letterboxdBody` (~13 files) does not change |
| `fontSize` xs–4xl | — | **delete all 8** — every value (size + line-height) equals v4's default. High confidence; confirm against the installed copy before deleting (`node_modules` absent in the orchestrator worktree) |
| `spacing` 18, 88 | — | **delete** — 0 uses in markup |
| `borderRadius` xl, 2xl | `--radius-xl`, `--radius-2xl` | 1 use |
| `boxShadow` letterboxd, -lg | `--shadow-letterboxd`, `--shadow-letterboxd-lg` | 4 uses |
| `animation` + `keyframes` | `--animate-fade-in`, `--animate-slide-up` + `@keyframes` in CSS | 1 use |
| `zIndex: {1}` | — | **delete** — v4 emits `z-1` natively |
| `screens.max-*` (6) | — | **delete all 6** — v4 auto-generates `max-md:` from the default `md` breakpoint (48rem). No `@custom-variant` needed; only `max-md:` is used (12×). Verify the native boundary matches before deleting |
| `content` array | — | **delete** — v4 auto-detects sources |

Consumers that must change in the same PR:

1. `__tests__/palette.contrast.test.ts:4` imports the JS config to read the
   palette. Re-source it by **parsing the `@theme` block in `index.css`**
   (CSS cannot be imported as a module, so the test reads and regex-extracts
   the `--color-letterboxd-*` declarations; `palette-utilities.mjs` is the
   place for that helper). This is the only non-mechanical piece.
2. The same test file snapshots `palette.svg`. After re-sourcing, run
   `yarn test -u` to regenerate it; values are unchanged, so the diff should
   be whitespace-only or empty.
3. Three `theme(...)` function calls in `index.css` → `var(--color-*)`.
4. `src/client/THEME.md` names `tailwind.config.js` in 3 places (tokens
   live there; `palette.svg` generated from it; line-heights in it). Update
   all three to point at the `@theme` block. (AGENTS.md does **not** name
   the file — no change needed there.)

Verify the no-op: `yarn build` succeeds, the contrast test passes, the
`palette.svg` snapshot is unchanged, and a before/after screenshot (or the
e2e suite) shows no visual change.

## 6. Allowed vs banned in `.tsx`

The ban list is an **explicit token enumeration**, not a prefix match —
`text-` is overloaded (size, color, alignment) so a prefix rule would break
color and alignment. Banned tokens:

- Font size: `text-xs`, `text-sm`, `text-base`, `text-lg`, `text-xl`,
  `text-2xl`, `text-3xl`, `text-4xl` (and larger).
- Font weight: `font-thin` … `font-black` (the named-weight scale).
- Spacing: `space-x-*`, `space-y-*`, `gap-*`, and raw `p{,x,y,t,r,b,l}-*` /
  `m{,x,y,t,r,b,l}-*` with a numeric step.
- Raw palette colors (existing rule): `text-|bg-|border-{tailwind palette}`.

Explicitly **allowed** (never flagged): `text-left|center|right|justify`,
`text-letterboxd-*` (color), layout and box utilities that carry no theme
meaning — `flex`, `grid`, `block`, `hidden`, `relative`, `absolute`, `w-*`,
`h-*`, `items-*`, `justify-*`, `rounded-*`, `shadow-*` — and responsive and
state variants (`max-md:`, `hover:`, the repo's `hover-desktop`).

## 7. Enforcement

Follow the existing `no-restricted-syntax` approach in
`src/client/eslint.config.mjs`. Add rules that flag banned classes in
`className` strings and point the author to the semantic class. Three
rules, each raised to error only when its category is fully migrated:

1. Color rule → error after the 34-hit burn-down.
2. Typography rule → error after type migration.
3. Spacing rule → error after spacing migration.

Each rule points the author at the semantic class to use instead, so the
error is self-correcting.

Known blind spot (state it, do not pretend otherwise): the rule inspects
`className="..."` string literals. Classes built dynamically — `cn()`,
`clsx()`, template literals — are not seen, so green CI is not proof of
zero raw classes. Mitigation: the rule also inspects string-literal
arguments to `cn()`/`clsx()`; anything more dynamic is caught in review, not
by lint. Keep `tailwind-merge` for safe class joining. Stylelint config is
unchanged.

## 8. Migration sequencing (small PRs)

Each phase is one or more PRs under the ~10-file / 400-line guide. Every PR
is visually a no-op; screenshots or the e2e suite prove it.

- Phase 0 — CSS-first config migration (1 PR): move `tailwind.config.js`
  into an `@theme` block in `index.css`, delete the JS file and `@config`
  directive, re-point the contrast test, swap the 3 `theme()` calls (§5.4).
  Visual + markup no-op. Also commit this design doc to
  `docs/superpowers/specs/` here.
- Phase 1 — Foundations (1 PR): add all `type-*` and spacing primitives to
  the now-unified `@theme`/`@utility` layer in `index.css`. Add the three
  lint rules at warn. No markup changed yet.
- Phase 2 — Color finish (1 PR): convert the 34 raw palette hits; raise the
  color rule to error.
- Phase 3 — Typography (several PRs, **grouped by page/route** — decided
  2026-11-01): each PR converts one route so its blast radius fits on one
  screen and a screenshot verifies it. Replace inline size/weight with
  `type-*`. Fold `subheading`, `section-title`, `table-heading-row` into the
  `type-*` set. Raise the type rule to error when the last group lands.
  **Amended 2026-11-04 — canonicalize, not no-op:** the measured markup uses
  ~20 inconsistent size+weight combos (a heading is `font-bold` on one page and
  `font-semibold` on another), so the 10-role set cannot stay pixel-identical
  without ~12 extra roles (the anti-goal). Decision: each size owns one canonical
  weight and call sites snap to the nearest role, so Phase 3 is a deliberate
  consistency pass, not a visual no-op. Added roles: `type-h1-lg` (`text-3xl`
  bold) and `type-strong` (`text-base` medium). Bespoke heroes (responsive serif,
  gold extralight) and decorative large glyphs stay out of the `type-*` set and
  get per-page handling.
- Phase 4 — Spacing (several PRs, **grouped by page/route** the same way):
  replace inline spacing with primitives. Raise the spacing rule to error
  when done.
- Phase 5 — Docs sync (folded into the last PR of each phase): update
  AGENTS.md "Code style" with the semantic vocabulary and the banned-class
  rule, per the repo's keep-in-sync requirement. (Phase 0 already handles
  the config-location docs: the 3 `tailwind.config.js` references in
  `THEME.md` — AGENTS.md never names the file.)

Ordering rationale: config migration first so every later phase extends one
`@theme` block, not two config systems. Color next because it is nearly done
and its rule already exists. Type before spacing because type roles are fewer
and the mapping is more mechanical.

## 9. Builder calls settled in this draft

These were mine to settle. Flag any you want changed.

- Naming: `type-*` for typography; `stack-*` / `cluster-*` / `pad-*` /
  `section-gap` for spacing. Chosen over `heading-1` / `text-h2` to avoid
  colliding with Tailwind's own `text-*` namespace, and `pad-*` over
  `inset-*` to avoid colliding with Tailwind's `inset-*` positioning
  utilities.
- `type-*` carries size + weight + family but not color, so color stays
  composable.
- No new color role aliases. Existing `letterboxd-*` tokens stay the color
  vocabulary.
- Spacing scale fixed at five steps; page padding stays in `main-content`.
- React primitive components explicitly excluded (per locked decision 1).

## 10. Resolved decisions

- PR grouping for Phase 3/4: **by page/route** (decided 2026-11-01). Each PR
  converts one route; blast radius fits one screen and a screenshot verifies
  the no-op.
- Padding primitives: `pad-*`, not `inset-*`.
- `stack-*`: flex-column + `gap`, not `space-y`.
- Responsive type: a role expresses its *own* fluid step with `clamp()` inside
  the role (e.g. `type-display`), not a `md:` variant. **Amended 2026-11-04:** a
  heading that steps between two *different* discrete roles at a breakpoint
  (`text-xl md:text-3xl font-bold`) is role **composition**, not one role's own
  step — write it `type-h2 md:type-h1-lg`. The lint bans raw `text-*`/`font-*`,
  not variant-prefixed role classes, so this is allowed. Weight follows each
  role's canonical weight, so the two steps may differ (semibold at `type-h2`,
  bold at `type-h1-lg`); that is accepted under canonicalisation.

Status: no open questions. Spec is ready for `writing-plans`.
