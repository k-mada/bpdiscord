vi.mock("../controllers/dataController", () => ({
  dbGetFilmDetail: vi.fn(),
}));
vi.mock("../embeds/posterImage", () => ({
  resolveCardPoster: vi.fn(),
}));
vi.mock("../embeds/renderFilmCard", () => ({
  renderFilmCardPng: vi.fn(),
}));

import express from "express";
import type { Server } from "http";
import type { AddressInfo } from "net";
import { dbGetFilmDetail } from "../controllers/dataController";
import { resolveCardPoster } from "../embeds/posterImage";
import { renderFilmCardPng } from "../embeds/renderFilmCard";
import ogRoutes from "../routes/ogRoutes";
import { routeStacks } from "./helpers/routerStack";

const film = {
  filmSlug: "silence",
  title: "Silence",
  releaseYear: 2016,
  poster: "https://a.ltrbxd.com/silence.jpg",
  letterboxdUrl: null,
  letterboxdRating: 3.99,
  watchedCount: 21,
  ratedCount: 17,
  averageRating: 4.15,
  ratings: [],
};
const PNG = Buffer.from("fake-png");
const CURRENT = "/api/og/film/silence.png?v=17-4.15-3.99";

let server: Server;
let baseUrl: string;

beforeAll(async () => {
  const app = express();
  app.use("/api/og", ogRoutes);
  server = app.listen(0);
  await new Promise<void>((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  vi.mocked(dbGetFilmDetail).mockReset().mockResolvedValue({ success: true, data: film });
  vi.mocked(resolveCardPoster).mockReset().mockResolvedValue({ src: "data:,", kind: "poster" });
  vi.mocked(renderFilmCardPng).mockReset().mockResolvedValue(PNG);
});

const get = (path: string) => fetch(`${baseUrl}${path}`, { redirect: "manual" });

describe("GET /api/og/film/:filmSlug.png", () => {
  it("renders the current version with CDN and cross-origin headers", async () => {
    const res = await get(CURRENT);

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/png");
    expect(res.headers.get("cache-control")).toBe(
      "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800",
    );
    expect(res.headers.get("cross-origin-resource-policy")).toBe("cross-origin");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(PNG);
    expect(resolveCardPoster).toHaveBeenCalledWith(film.poster);
    expect(renderFilmCardPng).toHaveBeenCalledWith(film, { src: "data:,", kind: "poster" });
  });

  it("handles slugs that contain dots", async () => {
    vi.mocked(dbGetFilmDetail).mockResolvedValue({
      success: true,
      data: { ...film, filmSlug: "mr.-nobody" },
    });

    const res = await get("/api/og/film/mr.-nobody.png?v=17-4.15-3.99");

    expect(res.status).toBe(200);
    expect(dbGetFilmDetail).toHaveBeenCalledWith("mr.-nobody");
  });

  it.each([
    ["a missing version", "/api/og/film/silence.png"],
    ["a stale version", "/api/og/film/silence.png?v=16-4.10-3.99"],
    ["an arbitrary version", "/api/og/film/silence.png?v=cache-bust-123"],
    ["a mixed-case slug", "/api/og/film/Silence.png?v=17-4.15-3.99"],
  ])("redirects %s to the current URL without rendering", async (_label, path) => {
    const res = await get(path);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(CURRENT);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(renderFilmCardPng).not.toHaveBeenCalled();
  });

  it("404s an unknown film", async () => {
    vi.mocked(dbGetFilmDetail).mockResolvedValue({ success: true, data: null });

    const res = await get("/api/og/film/nope.png");

    expect(res.status).toBe(404);
  });

  it("400s a malformed slug without querying", async () => {
    const res = await get("/api/og/film/a%20b.png");

    expect(res.status).toBe(400);
    expect(dbGetFilmDetail).not.toHaveBeenCalled();
  });

  it("500s when the DB read fails", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(dbGetFilmDetail).mockResolvedValue({ success: false, error: "down" });

    const res = await get(CURRENT);

    expect(res.status).toBe(500);
    errSpy.mockRestore();
  });

  it("500s when rendering throws", async () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(renderFilmCardPng).mockRejectedValue(new Error("boom"));

    const res = await get(CURRENT);

    expect(res.status).toBe(500);
    errSpy.mockRestore();
  });
});

describe("ogRoutes wiring", () => {
  it("rate-limits and validates the image route", () => {
    const routes = routeStacks(ogRoutes);

    expect(routes.map((r) => `${r.method} ${r.path}`)).toEqual([
      "GET /film/:filmSlug.png",
    ]);
    expect(routes[0]?.middleware).toContain("handleValidationErrors");
    expect(routes[0]?.middleware.at(-1)).toBe("getFilmCardImage");
  });
});
