import { test, expect } from "@playwright/test";

// A skip link is hidden until :focus, which is CSS plus real focus — jsdom has
// neither. Clipped forever by its own rule is the classic silent failure.

const HARNESS = "/e2e/harness/layout/";

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
});

test("the skip link is the first stop, becomes visible, and moves focus into main", async ({
  page,
}) => {
  const skip = page.getByRole("link", { name: "Skip to main content" });

  // sr-only collapses the box; a link nobody can see is a link nobody uses.
  expect((await skip.boundingBox())!.width).toBeLessThan(2);

  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  expect((await skip.boundingBox())!.width).toBeGreaterThan(80);

  await page.keyboard.press("Enter");

  await expect(page.locator("main")).toBeFocused();
});

test("the route title follows navigation", async ({ page }) => {
  await expect(page).toHaveTitle(/^Compare users — /);

  await page.getByRole("link", { name: "to stats" }).click();

  await expect(page).toHaveTitle(/^Stats — /);
  await expect(page.locator('[aria-live="polite"]')).toHaveText("Stats");
});
