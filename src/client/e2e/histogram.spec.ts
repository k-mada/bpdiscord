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
test("the histogram adds no tab stops to real keyboard navigation", async ({
  page,
}) => {
  await page.getByTestId("before").focus();

  const visited: string[] = [];
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    visited.push(
      await page.evaluate(
        () => document.activeElement?.getAttribute("data-testid") ?? "",
      ),
    );
    const insideHistogram = await page.evaluate(() =>
      document
        .querySelector('[data-testid="histogram"]')!
        .contains(document.activeElement),
    );
    expect(insideHistogram).toBe(false);
  }
  expect(visited).not.toContain("histogram");
});
