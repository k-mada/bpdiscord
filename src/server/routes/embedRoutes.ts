import { Request, Response, Router } from "express";
import rateLimit from "express-rate-limit";
import {
  EmbedContext,
  EmbedPage,
  defaultPageMeta,
  embedPages,
} from "../embeds/registry";
import { PageMeta, renderMetaHtml } from "../embeds/renderMetaHtml";

// Only link-preview bots reach this router (vercel.json routes them by UA), and
// Discord's fetchers share a few IPs, so the cap has to cover a whole server.
const embedLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 300,
  skip: () => process.env.NODE_ENV !== "production",
  message: "Too many requests, please try again later.",
});

// Request host rather than an env var, so a preview deploy points image URLs
// at itself. A spoofed Host only changes that one uncached response.
function requestContext(req: Request): EmbedContext {
  return { origin: `${req.protocol}://${req.get("host")}` };
}

function sendMeta(req: Request, res: Response, meta: PageMeta): void {
  const { origin } = requestContext(req);
  // The CDN must never cache this: people request the same URL and get the SPA.
  res.set("Cache-Control", "private, no-store");
  res.type("html").send(renderMetaHtml(meta, `${origin}${req.path}`));
}

function pageHandler(page: EmbedPage) {
  return async function embedPage(req: Request, res: Response): Promise<void> {
    const context = requestContext(req);
    let meta: PageMeta | null = null;
    try {
      meta = await page.resolve(req.params, context);
    } catch (error) {
      console.error(`Embed resolver failed for ${page.path}:`, error);
    }
    sendMeta(req, res, meta ?? defaultPageMeta(context));
  };
}

function defaultEmbed(req: Request, res: Response): void {
  sendMeta(req, res, defaultPageMeta(requestContext(req)));
}

export function createEmbedRouter(pages: EmbedPage[]): Router {
  const router = Router();
  for (const page of pages) {
    router.get(page.path, embedLimiter, pageHandler(page));
  }
  // Unknown /api paths must keep their JSON 404, not get a 200 HTML card.
  // Case-insensitive like Express's own mounts, which also serve /API/...
  router.get(/^\/(?!api(?:\/|$))/i, embedLimiter, defaultEmbed);
  return router;
}

export default createEmbedRouter(embedPages);
