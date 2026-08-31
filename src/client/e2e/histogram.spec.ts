import { test, expect } from "@playwright/test";

// Only what needs real layout, scrolling, or sequential Tab. Everything jsdom
// can assert lives in __tests__/RatingDistributionHistogram.test.tsx and runs
// ~100x faster.

const HARNESS = "/e2e/harness/";

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
});

// The jsdom twin queries focusable selectors; this walks real focus, the only
// way to catch something the browser treats as tabbable and the list misses.
// One stop is the contract: the counts disclosure. Ten focusable bars is what
// the aria-hidden decorative markup exists to avoid.
test("the histogram costs exactly one tab stop, and no bar is focusable", async ({
  page,
}) => {
  await page.getByTestId("before").focus();

  const stopsInsideHistogram: string[] = [];

  // Sweep one pass of the page order and stop at its last control; Tab past
  // that wraps back around and would count the same stop twice.
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press("Tab");
    const stop = await page.evaluate(() => {
      const active = document.activeElement!;
      const histogram = document.querySelector('[data-testid="histogram"]')!;
      return {
        inside: histogram.contains(active),
        tag: active.tagName.toLowerCase(),
        onBar: !!active.closest(".histogram-bar"),
        testid: active.getAttribute("data-testid"),
      };
    });

    expect(stop.onBar).toBe(false);
    if (stop.inside) stopsInsideHistogram.push(stop.tag);
    if (stop.testid === "after") break;
  }

  expect(stopsInsideHistogram).toEqual(["summary"]);
});

test("the counts stay reachable without a pointer", async ({ page }) => {
  await page.getByTestId("before").focus();
  await page.keyboard.press("Tab");

  await expect(page.locator("details summary")).toBeFocused();
  expect(await page.locator("details").evaluate((d: HTMLDetailsElement) => d.open)).toBe(false);

  await page.keyboard.press("Enter");

  expect(await page.locator("details").evaluate((d: HTMLDetailsElement) => d.open)).toBe(true);
  await expect(page.locator("details tbody tr")).toHaveCount(10);
});
