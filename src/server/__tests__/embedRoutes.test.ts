import express from "express";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { createEmbedRouter } from "../routes/embedRoutes";
import { EmbedPage, SITE_TITLE } from "../embeds/registry";
import { routeStacks } from "./helpers/routerStack";

const filmPage: EmbedPage = {
  path: "/film/:filmSlug",
  resolve: vi.fn(),
};

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use(createEmbedRouter([filmPage]));
  app.use((_req, res) => {
    res.status(404).json({ error: "Route not found" });
  });
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  vi.mocked(filmPage.resolve).mockReset();
});

const ogTitle = (html: string) =>
  html.match(/<meta property="og:title" content="([^"]*)" \/>/)?.[1];

describe("embed router", () => {
  it("serves the resolver's meta with absolute URLs from the request host", async () => {
    vi.mocked(filmPage.resolve).mockResolvedValue({ title: "Heat", card: "summary" });

    const res = await fetch(`${baseUrl}/film/heat`);
    const html = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/text\/html/);
    expect(ogTitle(html)).toBe("Heat");
    expect(html).toContain(`<meta property="og:url" content="${baseUrl}/film/heat" />`);
    expect(filmPage.resolve).toHaveBeenCalledWith(
      { filmSlug: "heat" },
      { origin: baseUrl },
    );
  });

  // People and bots share these URLs; a CDN-cached bot page would blank the SPA.
  it("forbids caching", async () => {
    vi.mocked(filmPage.resolve).mockResolvedValue({ title: "Heat", card: "summary" });

    const res = await fetch(`${baseUrl}/film/heat`);

    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it.each(["/film/heat/", "/FILM/heat"])("matches %s", async (path) => {
    vi.mocked(filmPage.resolve).mockResolvedValue({ title: "Heat", card: "summary" });

    const html = await (await fetch(`${baseUrl}${path}`)).text();

    expect(ogTitle(html)).toBe("Heat");
  });

  it("falls back to the site defaults when the resolver returns null", async () => {
    vi.mocked(filmPage.resolve).mockResolvedValue(null);

    const html = await (await fetch(`${baseUrl}/film/nope`)).text();

    expect(ogTitle(html)).toBe(SITE_TITLE);
  });

  it("falls back to the site defaults when the resolver throws", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(filmPage.resolve).mockRejectedValue(new Error("db down"));

    const res = await fetch(`${baseUrl}/film/heat`);

    expect(res.status).toBe(200);
    expect(ogTitle(await res.text())).toBe(SITE_TITLE);
  });

  it("serves the site defaults, with the logo, for pages without a resolver", async () => {
    const html = await (await fetch(`${baseUrl}/stats`)).text();

    expect(ogTitle(html)).toBe(SITE_TITLE);
    expect(html).toContain(`<meta property="og:image" content="${baseUrl}/logo512.png" />`);
    expect(filmPage.resolve).not.toHaveBeenCalled();
  });

  it.each(["/api", "/api/nope"])("leaves %s to the JSON 404", async (path) => {
    const res = await fetch(`${baseUrl}${path}`);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "Route not found" });
  });

  it("serves HEAD for fetchers that probe first", async () => {
    vi.mocked(filmPage.resolve).mockResolvedValue({ title: "Heat", card: "summary" });

    const res = await fetch(`${baseUrl}/film/heat`, { method: "HEAD" });

    expect(res.status).toBe(200);
  });
});

describe("embed router wiring", () => {
  // express-rate-limit returns an anonymous function, so the limiter shows as
  // the unnamed layer ahead of each handler.
  it("rate-limits every route, registered pages before the default", () => {
    const routes = routeStacks(createEmbedRouter([filmPage]));

    expect(
      routes.map((r) => [r.method, String(r.path), r.middleware]),
    ).toEqual([
      ["GET", "/film/:filmSlug", ["<anonymous>", "embedPage"]],
      ["GET", String(/^\/(?!api(?:\/|$))/), ["<anonymous>", "defaultEmbed"]],
    ]);
  });
});
