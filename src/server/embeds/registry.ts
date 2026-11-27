import type { PageMeta } from "./renderMetaHtml";

export interface EmbedContext {
  /** Absolute site origin, e.g. `https://www.thebigpicdiscord.com`, for building image URLs. */
  origin: string;
}

export interface EmbedPage {
  /** Express path pattern matching the client route, e.g. `/film/:filmSlug`. */
  path: string;
  /** `null` falls back to the site defaults, as does a throw. */
  resolve: (
    params: Record<string, string>,
    context: EmbedContext,
  ) => Promise<PageMeta | null>;
}

export const SITE_TITLE = "The Big Picture Discord";

export function defaultPageMeta({ origin }: EmbedContext): PageMeta {
  return {
    title: SITE_TITLE,
    siteName: SITE_TITLE,
    description:
      "This is a fun project meant to augment the Letterboxd experience specifically for the members of this Discord.",
    imageUrl: `${origin}/logo512.png`,
    imageWidth: 512,
    imageHeight: 512,
    card: "summary",
  };
}
