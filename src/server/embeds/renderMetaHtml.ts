import { EMBED_PALETTE } from "./palette";

export interface PageMeta {
  title: string;
  card: "summary" | "summary_large_image";
  /** Omitted fields emit no tag at all, so the chat app shows no line for them. */
  description?: string;
  siteName?: string;
  /** Must be absolute: most link-preview fetchers ignore relative image URLs. */
  imageUrl?: string;
  imageWidth?: number;
  imageHeight?: number;
}

/** Discord tints the embed's side bar with `theme-color`. */
export const EMBED_THEME_COLOR = EMBED_PALETTE["letterboxd-accent"];

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const property = (name: string, content: string | number): string =>
  `<meta property="${name}" content="${escapeHtml(String(content))}" />`;

const named = (name: string, content: string | number): string =>
  `<meta name="${name}" content="${escapeHtml(String(content))}" />`;

/**
 * Meta-only document for link-preview bots. `pageUrl` is the absolute URL of
 * the page the bot asked for; it becomes `og:url` and the canonical link.
 */
export function renderMetaHtml(meta: PageMeta, pageUrl: string): string {
  const tags: string[] = [
    `<link rel="canonical" href="${escapeHtml(pageUrl)}" />`,
    property("og:type", "website"),
    property("og:url", pageUrl),
    property("og:title", meta.title),
    named("twitter:title", meta.title),
    named("twitter:card", meta.card),
    named("theme-color", EMBED_THEME_COLOR),
  ];

  if (meta.siteName !== undefined) {
    tags.push(property("og:site_name", meta.siteName));
  }

  if (meta.description !== undefined) {
    tags.push(
      named("description", meta.description),
      property("og:description", meta.description),
      named("twitter:description", meta.description),
    );
  }

  if (meta.imageUrl !== undefined) {
    tags.push(property("og:image", meta.imageUrl), named("twitter:image", meta.imageUrl));
    if (meta.imageWidth !== undefined) tags.push(property("og:image:width", meta.imageWidth));
    if (meta.imageHeight !== undefined) tags.push(property("og:image:height", meta.imageHeight));
  }

  const title = escapeHtml(meta.title);
  return [
    "<!DOCTYPE html>",
    '<html lang="en">',
    "<head>",
    '<meta charset="utf-8" />',
    `<title>${title}</title>`,
    ...tags,
    "</head>",
    "<body>",
    `<a href="${escapeHtml(pageUrl)}">${title}</a>`,
    "</body>",
    "</html>",
  ].join("\n");
}
