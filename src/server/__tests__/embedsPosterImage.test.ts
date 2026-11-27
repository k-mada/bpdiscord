import {
  fetchPosterDataUri,
  isAllowedPosterUrl,
  resolveCardPoster,
} from "../embeds/posterImage";

const POSTER = "https://a.ltrbxd.com/resized/film-poster/heat-0-230-0-345-crop.jpg";

const imageResponse = (body: Uint8Array, type = "image/jpeg", status = 200) =>
  new Response(body, { status, headers: { "content-type": type } });

let fetchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  fetchSpy = vi.spyOn(globalThis, "fetch");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("isAllowedPosterUrl", () => {
  it.each([
    [POSTER, true],
    ["https://ltrbxd.com/x.jpg", true],
    ["http://a.ltrbxd.com/x.jpg", false],
    ["https://evil-ltrbxd.com/x.jpg", false],
    ["https://a.ltrbxd.com.evil.test/x.jpg", false],
    ["https://169.254.169.254/latest/meta-data", false],
    ["not a url", false],
  ])("%s → %s", (url, allowed) => {
    expect(isAllowedPosterUrl(url)).toBe(allowed);
  });
});

describe("fetchPosterDataUri", () => {
  it("returns the poster as a data URI", async () => {
    fetchSpy.mockResolvedValue(imageResponse(new Uint8Array([1, 2, 3])));

    expect(await fetchPosterDataUri(POSTER)).toBe("data:image/jpeg;base64,AQID");
  });

  it("never fetches a URL off the allowlist", async () => {
    expect(await fetchPosterDataUri("https://169.254.169.254/x.jpg")).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("returns null without fetching when there is no poster", async () => {
    expect(await fetchPosterDataUri(null)).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each([
    ["a non-2xx status", imageResponse(new Uint8Array([1]), "image/jpeg", 404)],
    ["a type satori can't decode", imageResponse(new Uint8Array([1]), "image/webp")],
    ["an empty body", imageResponse(new Uint8Array([]))],
    ["an oversized body", imageResponse(new Uint8Array(2 * 1024 * 1024 + 1))],
  ])("returns null for %s", async (_label, response) => {
    fetchSpy.mockResolvedValue(response);

    expect(await fetchPosterDataUri(POSTER)).toBeNull();
  });

  it("returns null when the fetch throws", async () => {
    fetchSpy.mockRejectedValue(new DOMException("timed out", "TimeoutError"));

    expect(await fetchPosterDataUri(POSTER)).toBeNull();
  });
});

describe("resolveCardPoster", () => {
  it("falls back to the bundled logo", async () => {
    fetchSpy.mockResolvedValue(imageResponse(new Uint8Array([1]), "image/jpeg", 500));

    const poster = await resolveCardPoster(POSTER);

    expect(poster.kind).toBe("logo");
    expect(poster.src).toMatch(/^data:image\/png;base64,iVBOR/);
  });
});
