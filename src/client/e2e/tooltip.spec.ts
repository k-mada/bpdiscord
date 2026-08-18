import { test, expect, type Page, type Locator } from "@playwright/test";

// Everything here needs real layout, real scrolling, or real Tab. jsdom has
// none of the three, so these cases cannot regress into the vitest suite.

const HARNESS = "/e2e/harness/";

async function boxes(page: Page) {
  return page.evaluate(() => {
    const trigger = document.querySelector<HTMLElement>(
      '[data-testid="trigger"]',
    )!;
    const tip = document.getElementById(
      trigger.getAttribute("aria-describedby")!,
    )!;
    const t = trigger.getBoundingClientRect();
    const p = tip.getBoundingClientRect();
    const gap = 12;
    const padding = 8;
    const above = t.top - tip.offsetHeight - gap;
    return {
      trigger: { top: t.top, bottom: t.bottom, left: t.left, right: t.right },
      tip: { top: p.top, bottom: p.bottom, left: p.left, right: p.right },
      // the component flips below when there is no room above
      expectedTop: above < padding ? t.bottom + gap : above,
      overlapsTrigger: !(
        p.right <= t.left ||
        p.left >= t.right ||
        p.bottom <= t.top ||
        p.top >= t.bottom
      ),
    };
  });
}

// Resolved through aria-describedby rather than by role: the histogram on this
// page renders ten more role="tooltip" nodes, and this asserts the wiring too.
async function tooltipOf(page: Page): Promise<Locator> {
  const id = await page.getByTestId("trigger").getAttribute("aria-describedby");
  expect(id).toBeTruthy();
  return page.locator(`[id="${id}"]`);
}

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await expect(page.getByTestId("trigger")).toBeAttached();
});

test("Tab reveals the tooltip and anchors it to the trigger", async ({
  page,
}) => {
  await page.getByTestId("before").focus();
  await expect(await tooltipOf(page)).toBeHidden();

  await page.keyboard.press("Tab");
  await expect(page.getByTestId("trigger")).toBeFocused();
  await expect(await tooltipOf(page)).toBeVisible();

  // Tab scrolled the trigger into view after focus fired. A popup positioned
  // from the pre-scroll rect lands far from here.
  const b = await boxes(page);
  expect(Math.abs(b.tip.top - b.expectedTop)).toBeLessThanOrEqual(4);
});

test("the tooltip never covers the trigger it describes (SC 2.4.11)", async ({
  page,
}) => {
  await page.getByTestId("before").focus();
  await page.keyboard.press("Tab");
  await expect(await tooltipOf(page)).toBeVisible();

  const b = await boxes(page);
  expect(b.overlapsTrigger).toBe(false);
});

test("the tooltip tracks its trigger through a scroll", async ({ page }) => {
  await page.getByTestId("before").focus();
  await page.keyboard.press("Tab");
  await expect(await tooltipOf(page)).toBeVisible();

  const before = await boxes(page);
  await page.mouse.wheel(0, 120);
  await expect
    .poll(async () => (await boxes(page)).trigger.top)
    .not.toBe(before.trigger.top);

  // poll the invariant, not just the scroll: repositioning lands a frame later
  await expect
    .poll(async () => {
      const after = await boxes(page);
      const triggerMoved = before.trigger.top - after.trigger.top;
      const tipMoved = before.tip.top - after.tip.top;
      return Math.round(Math.abs(triggerMoved - tipMoved));
    })
    .toBeLessThanOrEqual(2);
  await expect(await tooltipOf(page)).toBeVisible();
});

test("the tooltip re-anchors after a viewport resize", async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 700 });
  await page.getByTestId("trigger").focus();
  await expect(await tooltipOf(page)).toBeVisible();

  const before = await boxes(page);
  const centredOn = (b: Awaited<ReturnType<typeof boxes>>) =>
    (b.tip.left + b.tip.right) / 2 - (b.trigger.left + b.trigger.right) / 2;
  expect(Math.abs(centredOn(before))).toBeLessThanOrEqual(2);

  await page.setViewportSize({ width: 700, height: 700 });
  await expect
    .poll(async () => Math.round((await boxes(page)).trigger.left))
    .not.toBe(Math.round(before.trigger.left));

  // the trigger moved with the reflow; the popup has to follow it
  await expect
    .poll(async () => Math.round(Math.abs(centredOn(await boxes(page)))))
    .toBeLessThanOrEqual(2);
});

test("stays visible while focused after the pointer leaves (SC 1.4.13)", async ({
  page,
}) => {
  const trigger = page.getByTestId("trigger");
  await trigger.focus();
  await expect(await tooltipOf(page)).toBeVisible();

  await trigger.hover();
  await page.getByTestId("before").hover();

  await expect(trigger).toBeFocused();
  await expect(await tooltipOf(page)).toBeVisible();
});

test("Escape dismisses without moving focus, and refocus re-arms", async ({
  page,
}) => {
  const trigger = page.getByTestId("trigger");
  await trigger.focus();
  await expect(await tooltipOf(page)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(await tooltipOf(page)).toBeHidden();
  await expect(trigger).toBeFocused();

  await page.getByTestId("before").focus();
  await trigger.focus();
  await expect(await tooltipOf(page)).toBeVisible();
});

test("the histogram adds no tab stops to real keyboard navigation", async ({
  page,
}) => {
  await page.getByTestId("trigger").focus();

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
