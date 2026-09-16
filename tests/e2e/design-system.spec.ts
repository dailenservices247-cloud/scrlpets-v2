import { expect, test, type Locator } from "@playwright/test";

/**
 * Measured against /design, never the real feed: fixture content never moves,
 * so a failure here is a design regression and not someone posting.
 *
 * The harness is gated by DESIGN_HARNESS, which playwright.config.ts sets on the
 * webServer — see src/lib/design/harness.ts for why NODE_ENV alone would hide
 * this page from its own tests.
 */
const fontOf = (locator: Locator) =>
  locator.evaluate((el) => getComputedStyle(el).fontFamily);

test.describe("identity typography", () => {
  test("a brand name renders in the display serif", async ({ page }) => {
    await page.goto("/design");
    const brand = page.getByTestId("brand-attribution").first();
    await expect(brand).toBeVisible();
    expect(await fontOf(brand)).toContain("Instrument");
  });

  test("the timestamp beside it does NOT — the serif is identity only", async ({ page }) => {
    await page.goto("/design");
    const time = page.getByTestId("post-permalink").first();
    await expect(time).toBeVisible();
    expect(await fontOf(time)).not.toContain("Instrument");
  });
});
