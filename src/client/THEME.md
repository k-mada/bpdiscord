# Letterboxd-Inspired Theme Documentation

A dark Tailwind theme inspired by Letterboxd. Tokens live in `tailwind.config.js`;
component utilities live in `index.css`.

**Conformance target: WCAG 2.2 Level AA.** Every foreground/background pairing below is
gated by `__tests__/palette.contrast.test.ts`, which reads the tokens directly and fails
the build on a regression. Contrast cannot be checked by axe under jsdom, so that test is
the only thing standing between an edit and a silent accessibility regression. Update it
alongside any palette change.

## Color Palette

### Backgrounds

| Token | Hex | Use |
| --- | --- | --- |
| `bg-letterboxd-bg-primary` | `#14181c` | Page background |
| `bg-letterboxd-bg-secondary` | `#2a2d2f` | Form fields, sticky table headers, dropdowns |
| `bg-letterboxd-bg-tertiary` | `#2c3440` | Bar-chart fills, hover states, poster placeholders |

### Text

| Token | Hex | Use |
| --- | --- | --- |
| `text-letterboxd-text-primary` | `#e0e0e0` | Headings and body copy |
| `text-letterboxd-text-secondary` | `#b8b8b8` | Labels, table headers, descriptions |
| `text-letterboxd-text-muted` | `#a0a0a0` | Placeholders, timestamps, subtitles |

### Accents

| Token | Hex | Use |
| --- | --- | --- |
| `letterboxd-accent` | `#00ac1c` | Primary button fill, stars, active states |
| `letterboxd-accent-hover` | `#009d1a` | Primary button hover |
| `letterboxd-pro` | `#f5c518` | PRO badge, Oscars headers and winner rings |
| `letterboxd-link-hover` | `#40bcf4` | Link hover |

### Borders

| Token | Hex | Use |
| --- | --- | --- |
| `border-letterboxd-border` | `#404040` | Decorative dividers and card edges |
| `border-letterboxd-border-light` | `#8a8a8a` | **Control boundaries only** — inputs, selects, checkboxes |

The split is deliberate. WCAG 1.4.11 requires 3:1 for the boundary of a UI component but
exempts purely decorative separators. `#404040` is 1.34:1 on `bg-secondary`, fine as a
divider and unusable as a field edge. Do not lighten the decorative token to match — that
turns the UI into a wireframe.

## Contrast matrix

Ratios against every surface, including the two alpha-composited backgrounds the
Oscars/Events tables render on. AA needs **4.5:1** for text and **3:1** for control
boundaries and focus indicators.

| Foreground | bg-primary | bg-secondary | bg-tertiary | row stripe `/30` | winner tint `/10` |
| --- | --- | --- | --- | --- | --- |
| `text-primary` `#e0e0e0` | 13.51 | 10.50 | 9.51 | 12.67 | 11.07 |
| `text-secondary` `#b8b8b8` | 8.99 | 6.99 | 6.33 | 8.43 | 7.37 |
| `text-muted` `#a0a0a0` | 6.82 | 5.30 | 4.80 | 6.40 | 5.59 |

Row stripe composites `bg-secondary` at 30% over `bg-primary` (`#1b1e22`); winner tint
composites `pro` at 10% (`#2b291c`).

Additional gated pairings:

| Pairing | Ratio | Requirement |
| --- | --- | --- |
| `.btn-primary` black label on `accent` | 6.92 | 4.5:1 |
| `.btn-primary` black label on `accent-hover` | 5.84 | 4.5:1 |
| `border-light` on `bg-secondary` | 3.51 | 3:1 |
| Focus outline `#e0e0e0` on any surface | ≥ 9.5 | 3:1 |

**`accent` is not a body-text colour.** At `#00ac1c` it measures 4.14:1 on `bg-tertiary`
and fails. Use it for fills, icons, and stars; use `text-primary` for figures that sit on
a tertiary surface.

## Focus

One indicator, defined once in the base layer:

```css
:focus-visible {
  outline: 2px solid theme(colors.letterboxd.text-primary);
  outline-offset: 2px;
}
```

Neutral rather than accent-coloured for two reasons: a green outline on the green
`.btn-primary` would be 1:1 against its own background, and `outline` is not clipped by
the `overflow-hidden` containers that clip a `ring` box-shadow.

Do not add per-component `focus:ring-*` or `focus:outline-hidden`. Controls inherit the
global indicator.

## Typography

Loaded from Google Fonts in two places: `index.html` links Be Vietnam Pro and
PT Serif; `index.css` `@import`s Playfair Display.

- `font-sans` (default) — Be Vietnam Pro, falling back to Roboto, Arial, sans-serif
- `font-letterboxdBody` — PT Serif
- Playfair Display is applied inline in the Oscars and Events components

`index.css` also `@import`s **Inter**, which appears in no `fontFamily`
declaration and is referenced nowhere — a render-blocking request for a font
that never gets used. Safe to delete; left in place here to keep this change
scoped to colour.

Type scale runs `text-xs` (0.75rem) through `text-4xl` (2.25rem); each step carries a
paired line-height in `tailwind.config.js`.

## Component utilities

Defined as `@utility` blocks in `index.css`.

| Class | What it is |
| --- | --- |
| `.card` | Padding only (`p-4`) — **no background, border, or shadow.** Card content inherits the page background |
| `.btn-primary` | Accent fill, **black** label, rounded |
| `.btn-secondary` | Secondary fill, primary text, decorative border |
| `.input-field` | Field background, control border, primary text, muted placeholder |
| `.subheading` | Large primary text with a decorative bottom rule |
| `.section-title` | Uppercase tracked section header |
| `.pro-badge` | Gold PRO badge |
| `.data-table` / `.table-heading-row` | Table and header-row styling |

## Motion

`animate-fade-in`, `animate-slide-up`, and `.bar-grow` are declared in `index.css`.
Anything animated must have a `prefers-reduced-motion: reduce` counterpart.

Reveal-style animations need care: `.movie-poster-fade-in li` starts at `opacity: 0` and
depends on the animation to become visible, so a reduced-motion override must set
`opacity: 1` rather than `animation: none`, or the list disappears entirely.

## Conventions

1. Reach for a token, never a raw hex, and never an ad-hoc grey.
2. Keep the three text tiers in order — primary for content, secondary for labels, muted
   for incidental detail. All three pass AA on every surface, so the choice is hierarchy,
   not legibility.
3. Never signal state with colour alone. Add text, an icon, or an accessible name — the
   Oscars winner ring is backed by `sr-only` text for exactly this reason.
4. Add new pairings to `__tests__/palette.contrast.test.ts` when introducing a surface or
   a foreground colour.
