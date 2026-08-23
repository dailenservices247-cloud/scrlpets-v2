import { test, expect } from "@playwright/test";

/**
 * Spanish shipped dictionary-complete (1775 keys, zero gaps in either
 * direction) and completely unreachable — `src/i18n/request.ts` hardcoded
 * "en". This proves the switch, not the dictionary.
 *
 * Signed OUT on purpose. The language control is cookie-backed so a
 * Spanish-speaking visitor can read the app before they have an account, and
 * public discovery without registration is a locked product strength. A test
 * that only ran signed-in would not notice the control moving behind auth.
 */
test.describe("language switcher", () => {
  test.describe.configure({ timeout: 120_000 });

  test("a signed-out visitor can switch the app to Spanish, and it sticks", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.getByTestId("language-switcher")).toBeVisible({ timeout: 20_000 });

    // English first, so the assertion below is a CHANGE and not a coincidence.
    await expect(page.getByTestId("language-switcher")).toContainText("Language");

    await page.getByTestId("language-es").click();

    // The heading is the one string on this page guaranteed to differ.
    await expect(page.getByTestId("language-switcher")).toContainText("Idioma", {
      timeout: 20_000,
    });

    // It survives a navigation — a switch that only repaints the current render
    // is not a preference, it is an animation.
    await page.goto("/menu");
    await expect(page.getByTestId("language-switcher")).toContainText("Idioma", {
      timeout: 20_000,
    });
    await expect(page.getByTestId("language-es")).toHaveAttribute("aria-pressed", "true");

    // And back, so this test leaves the browser context as it found it.
    await page.getByTestId("language-en").click();
    await expect(page.getByTestId("language-switcher")).toContainText("Language", {
      timeout: 20_000,
    });
  });
});
