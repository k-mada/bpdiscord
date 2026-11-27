import { filmEmbedPage } from "./filmEmbed";
import type { EmbedPage } from "./registry";

/** Pages with their own link-preview card. Anything else gets the site defaults. */
export const embedPages: EmbedPage[] = [filmEmbedPage];
