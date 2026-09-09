import { test, expect } from "@playwright/test";

// Modal is the largest behavioural surface in the client — focus trap, dialog
// stack, background inert, focus restore — and jsdom implements neither inert
// nor real focus semantics, so its __tests__ twin cannot see any of it. The
// harness renders without StrictMode (harness/modal/modal.tsx), so this
// exercises the production focus path, not dev's double-invoke (bpdiscord-6gh).

const HARNESS = "/e2e/harness/modal/";
const PANEL = '[role="dialog"]';

const backgroundIsInert = (page: import("@playwright/test").Page) =>
  page.evaluate(
    () =>
      !!document
        .querySelector('[data-testid="background"]')
        ?.closest("[inert]"),
  );

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
});

test("opening moves focus into the panel", async ({ page }) => {
  await page.getByTestId("open").click();
  const panel = page.locator(PANEL);
  await expect(panel).toBeVisible();
  await expect(panel).toBeFocused();
});

// The trap only matters at the ends; between them Tab is native. First
// focusable is the header Close button, last is the final body control.
test("Tab wraps forward at the last control and backward at the first", async ({
  page,
}) => {
  await page.getByTestId("open").click();
  await expect(page.locator(PANEL)).toBeFocused();

  await page.getByTestId("body-last").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Close" })).toBeFocused();

  await page.keyboard.press("Shift+Tab");
  await expect(page.getByTestId("body-last")).toBeFocused();
});

test("Escape closes the dialog and returns focus to the trigger", async ({
  page,
}) => {
  const trigger = page.getByTestId("open");
  await trigger.click();
  await expect(page.locator(PANEL)).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(page.locator(PANEL)).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("the background is inert while open and interactive after close", async ({
  page,
}) => {
  expect(await backgroundIsInert(page)).toBe(false);

  await page.getByTestId("open").click();
  await expect(page.locator(PANEL)).toBeVisible();
  expect(await backgroundIsInert(page)).toBe(true);

  await page.keyboard.press("Escape");
  await expect(page.locator(PANEL)).toHaveCount(0);
  expect(await backgroundIsInert(page)).toBe(false);
});

// The complement to inert: no Tab sweep, however long, escapes onto the
// background trigger sealed behind [inert].
test("a background control cannot be reached by Tab while the dialog is open", async ({
  page,
}) => {
  await page.getByTestId("open").click();
  await expect(page.locator(PANEL)).toBeFocused();

  for (let i = 0; i < 6; i++) {
    await page.keyboard.press("Tab");
    const onBackground = await page.evaluate(
      () =>
        document.activeElement?.getAttribute("data-testid") === "background",
    );
    expect(onBackground).toBe(false);
  }
});
