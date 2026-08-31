import { test, expect } from "@playwright/test";

// Only what needs real layout, a real pointer, or real :focus-visible. The
// jsdom twin is __tests__/RatingDistributionHistogram.test.tsx.

const HARNESS = "/e2e/harness/";

const TALLEST_BAR = '[data-bar-index="8"]';
const PANEL = '[data-testid="histogram-tooltip"]';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
});

// The jsdom twin queries focusable selectors; this walks real focus, the only
// way to catch what the browser treats as tabbable and that list misses.
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
        role: active.getAttribute("role"),
        onBar: !!active.closest(".histogram-bar"),
        testid: active.getAttribute("data-testid"),
      };
    });

    expect(stop.onBar).toBe(false);
    if (stop.inside) stopsInsideHistogram.push(stop.role ?? "");
    if (stop.testid === "after") break;
  }

  expect(stopsInsideHistogram).toEqual(["group"]);
});

// 1.4.13 hoverable, the one clause the deleted Tooltip failed. mouseleave
// resolves by DOM containment, so a descendant panel survives the trip.
test("the pointer can travel onto the panel without it closing", async ({
  page,
}) => {
  await page.locator(TALLEST_BAR).hover();
  const panel = page.locator(PANEL);
  await expect(panel).toBeVisible();

  const box = (await panel.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);

  await expect(panel).toBeVisible();
  await expect(panel).toContainText("4.5 stars: 12");
});

// The clause that made the old component unpredictable: a click focused the
// trigger, focus latched, and the panel outlived the pointer.
test("clicking a bar does not pin the panel open", async ({ page }) => {
  await page.locator(TALLEST_BAR).click();
  await expect(page.locator(PANEL)).toBeVisible();

  await page.mouse.move(0, 0);

  await expect(page.locator(PANEL)).toHaveCount(0);
});

// Needs a real browser twice over: :focus-visible only resolves under a real
// Tab, and jsdom has no such selector at all.
test("keyboard focus opens the panel, arrows move it, Escape dismisses it", async ({
  page,
}) => {
  await page.getByTestId("before").focus();
  await page.keyboard.press("Tab");

  await expect(page.locator('[role="group"]')).toBeFocused();
  await expect(page.locator(PANEL)).toContainText("0.5 stars");

  await page.keyboard.press("End");
  await expect(page.locator(PANEL)).toContainText("5 stars");

  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(PANEL)).toContainText("4.5 stars: 12");

  await page.keyboard.press("Escape");
  await expect(page.locator(PANEL)).toHaveCount(0);
  await expect(page.locator('[role="group"]')).toBeFocused();
});
