import { test, expect } from "@playwright/test";

// jsdom has no layout, scroll geometry or sticky positioning; only a real
// browser reveals a focused body link sliding under the sticky header.

const HARNESS = "/e2e/harness/datatable/";
const LAST = '[data-testid="link-film-number-30"]';
const FIRST = '[data-testid="link-film-number-1"]';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
});

const geometry = () =>
  ({
    headerBottom: document
      .querySelector(".data-table thead th")!
      .getBoundingClientRect().bottom,
    active: (() => {
      const el = document.activeElement;
      const link = el?.closest("tbody a");
      return link
        ? { top: link.getBoundingClientRect().top, id: link.getAttribute("data-testid") }
        : null;
    })(),
  }) as { headerBottom: number; active: { top: number; id: string | null } | null };

// The bug only surfaces on a top-aligning scroll: tabbing down bottom-aligns the
// focused row (visible), so focus must move UP to a row scrolled above the fold.
test("a focused body link never sits under the sticky header", async ({
  page,
}) => {
  await page.getByTestId("before").focus();

  // Tab to the last link so the container is scrolled to the bottom and the
  // early rows are off-screen above.
  await page.keyboard.press("Tab");
  while (
    (await page.evaluate(
      () => document.activeElement?.getAttribute("data-testid"),
    )) !== "link-film-number-30"
  ) {
    await page.keyboard.press("Tab");
  }
  await expect(page.locator(LAST)).toBeFocused();

  // The label wraps to two lines here; if a style change stops it wrapping the
  // harness would no longer exercise the worst-case header height.
  const headerHeight = await page.evaluate(
    () =>
      document.querySelector(".data-table thead th")!.getBoundingClientRect()
        .height,
  );
  expect(headerHeight).toBeGreaterThan(60);

  // Shift+Tab all the way back up. Every link that scrolls to the top must stop
  // at or below the header's bottom edge, tolerance for sub-pixel rounding.
  while (
    (await page.evaluate(
      () => document.activeElement?.getAttribute("data-testid"),
    )) !== "link-film-number-1"
  ) {
    await page.keyboard.press("Shift+Tab");
    const g = await page.evaluate(geometry);
    if (g.active) {
      expect(
        g.active.top,
        `${g.active.id} top ${g.active.top} is above header bottom ${g.headerBottom}`,
      ).toBeGreaterThanOrEqual(g.headerBottom - 1);
    }
  }

  await expect(page.locator(FIRST)).toBeFocused();
});
