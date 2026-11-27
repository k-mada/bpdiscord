/**
 * `letterboxd-*` token values the server renders with. It can't import the
 * client's CSS, so `__tests__/embedsRenderMetaHtml.test.ts` checks every entry
 * against `src/client/index.css` and fails on drift.
 */
export const EMBED_PALETTE = {
  "letterboxd-accent": "#00ac1c",
  "letterboxd-bg-primary": "#14181c",
  "letterboxd-bg-secondary": "#2a2d2f",
  "letterboxd-text-primary": "#e0e0e0",
  "letterboxd-text-muted": "#a0a0a0",
  "letterboxd-pro": "#f5c518",
} as const;
