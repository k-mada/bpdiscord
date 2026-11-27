import { readFileSync } from "fs";
import path from "path";
import type { CardPoster } from "./filmCard";

const POSTER_TIMEOUT_MS = 3000;
const MAX_POSTER_BYTES = 2 * 1024 * 1024;
// Satori decodes these; WebP and AVIF it can't.
const POSTER_TYPES = new Set(["image/jpeg", "image/png"]);

// Poster URLs come from rows the scraper writes; only Letterboxd's image CDN is
// fetched, so a bad row can't point the server at an internal address.
export function isAllowedPosterUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)ltrbxd\.com$/.test(url.hostname);
  } catch {
    return false;
  }
}

/** Never throws: any failure returns null so the card falls back to the logo. */
export async function fetchPosterDataUri(
  posterUrl: string | null,
): Promise<string | null> {
  if (!posterUrl || !isAllowedPosterUrl(posterUrl)) return null;
  try {
    const res = await fetch(posterUrl, {
      signal: AbortSignal.timeout(POSTER_TIMEOUT_MS),
      redirect: "error",
    });
    const type = res.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    if (!res.ok || !POSTER_TYPES.has(type)) return null;

    const bytes = Buffer.from(await res.arrayBuffer());
    if (bytes.length === 0 || bytes.length > MAX_POSTER_BYTES) return null;
    return `data:${type};base64,${bytes.toString("base64")}`;
  } catch (error) {
    console.warn("Poster fetch failed:", posterUrl, error);
    return null;
  }
}

let logoDataUri: string | undefined;

function logoPoster(): CardPoster {
  logoDataUri ??= `data:image/png;base64,${readFileSync(
    path.join(__dirname, "../assets/bpd-logo.png"),
  ).toString("base64")}`;
  return { src: logoDataUri, kind: "logo" };
}

export async function resolveCardPoster(
  posterUrl: string | null,
): Promise<CardPoster> {
  const src = await fetchPosterDataUri(posterUrl);
  return src ? { src, kind: "poster" } : logoPoster();
}
