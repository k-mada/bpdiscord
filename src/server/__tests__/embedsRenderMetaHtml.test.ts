import { readFileSync } from "fs";
import path from "path";
import {
  EMBED_THEME_COLOR,
  PageMeta,
  escapeHtml,
  renderMetaHtml,
} from "../embeds/renderMetaHtml";

const PAGE_URL = "https://example.test/film/heat";

const metaContent = (html: string, attr: "property" | "name", key: string) =>
  html.match(new RegExp(`<meta ${attr}="${key}" content="([^"]*)" />`))?.[1];

describe("escapeHtml", () => {
  it("escapes every character that can break out of an attribute or element", () => {
    expect(escapeHtml(`<a href="x">Tom & Jerry's</a>`)).toBe(
      "&lt;a href=&quot;x&quot;&gt;Tom &amp; Jerry&#39;s&lt;/a&gt;",
    );
  });
});

describe("renderMetaHtml", () => {
  const full: PageMeta = {
    title: "Heat",
    card: "summary_large_image",
    description: "A film",
    siteName: "Site",
    imageUrl: "https://example.test/og/heat.png",
    imageWidth: 900,
    imageHeight: 470,
  };

  it("writes the title, card, url and theme colour", () => {
    const html = renderMetaHtml(full, PAGE_URL);

    expect(html).toContain("<title>Heat</title>");
    expect(metaContent(html, "property", "og:title")).toBe("Heat");
    expect(metaContent(html, "name", "twitter:title")).toBe("Heat");
    expect(metaContent(html, "name", "twitter:card")).toBe("summary_large_image");
    expect(metaContent(html, "property", "og:url")).toBe(PAGE_URL);
    expect(metaContent(html, "name", "theme-color")).toBe(EMBED_THEME_COLOR);
    expect(html).toContain(`<link rel="canonical" href="${PAGE_URL}" />`);
  });

  it("writes the optional tags when present", () => {
    const html = renderMetaHtml(full, PAGE_URL);

    expect(metaContent(html, "property", "og:site_name")).toBe("Site");
    expect(metaContent(html, "property", "og:description")).toBe("A film");
    expect(metaContent(html, "name", "twitter:description")).toBe("A film");
    expect(metaContent(html, "name", "description")).toBe("A film");
    expect(metaContent(html, "property", "og:image")).toBe(full.imageUrl);
    expect(metaContent(html, "name", "twitter:image")).toBe(full.imageUrl);
    expect(metaContent(html, "property", "og:image:width")).toBe("900");
    expect(metaContent(html, "property", "og:image:height")).toBe("470");
  });

  // An empty tag still renders a blank line in Discord; absent means no line.
  it("emits no tag at all for omitted fields", () => {
    const html = renderMetaHtml({ title: "Heat", card: "summary" }, PAGE_URL);

    expect(html).not.toMatch(/og:site_name|description|og:image|twitter:image/);
  });

  it("escapes scraped values so a title cannot inject markup", () => {
    const html = renderMetaHtml(
      { title: `"><script>alert(1)</script>`, card: "summary" },
      PAGE_URL,
    );

    expect(html).not.toContain("<script>");
    expect(metaContent(html, "property", "og:title")).toBe(
      "&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });
});

// The server can't import client CSS, so it mirrors token values instead.
describe("embed colours mirror the client palette tokens", () => {
  const css = readFileSync(path.join(__dirname, "../../client/index.css"), "utf8");
  const token = (name: string) =>
    css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{3,8});`))?.[1];

  it.each([["letterboxd-accent", EMBED_THEME_COLOR]])("%s", (name, value) => {
    expect(token(name)?.toLowerCase()).toBe(value.toLowerCase());
  });
});
