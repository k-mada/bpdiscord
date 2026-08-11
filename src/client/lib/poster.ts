// Letterboxd poster URLs carry their crop size in the path.
const CROP_PATTERN = /-0-(\d+)-0-(\d+)-crop/;

// The CDN only serves these crop widths and 403s anything else, so a request
// snaps up to the next width it actually has.
const CDN_WIDTHS = [125, 150, 230, 300, 400, 460, 500, 600, 1000];

/**
 * Rewrites a Letterboxd poster URL to the smallest available crop at least
 * `targetWidth` wide, deriving the height from the source aspect ratio. Returns
 * the URL untouched when the path carries no crop size, so a CDN format change
 * degrades to the stored image rather than a broken one.
 */
export function posterAtWidth(url: string, targetWidth: number): string {
  const match = url.match(CROP_PATTERN);
  if (!match) return url;

  const sourceWidth = Number(match[1]);
  const sourceHeight = Number(match[2]);
  if (!sourceWidth || !sourceHeight) return url;

  const width =
    CDN_WIDTHS.find((w) => w >= targetWidth) ?? CDN_WIDTHS[CDN_WIDTHS.length - 1]!;
  if (width === sourceWidth) return url;

  const height = Math.round(sourceHeight * (width / sourceWidth));
  return url.replace(CROP_PATTERN, `-0-${width}-0-${height}-crop`);
}
