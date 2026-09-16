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

const borderTopOf = (locator: Locator) =>
  locator.evaluate((el) => parseFloat(getComputedStyle(el).borderTopWidth));

test.describe("editorial register", () => {
  test("post body copy is at least 16px", async ({ page }) => {
    await page.goto("/design");
    const body = page.getByTestId("post-body").first();
    await expect(body).toBeVisible();
    const size = await body.evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeGreaterThanOrEqual(16);
  });

  test("a post tile has no card border — the box is gone", async ({ page }) => {
    await page.goto("/design");
    const tile = page.getByTestId("tile-post").first();
    await expect(tile).toBeVisible();
    expect(await borderTopOf(tile)).toBe(0);
  });

  test("a listing tile still has one — the panel register survives", async ({ page }) => {
    await page.goto("/design");
    const tile = page.getByTestId("tile-listing").first();
    await expect(tile).toBeVisible();
    expect(await borderTopOf(tile)).toBeGreaterThan(0);
  });

  test("editorial entries are separated by a hairline", async ({ page }) => {
    await page.goto("/design");
    const tile = page.getByTestId("tile-post").first();
    await expect(tile).toBeVisible();
    const width = await tile.evaluate((el) => parseFloat(getComputedStyle(el).borderBottomWidth));
    expect(width).toBeGreaterThan(0);
  });
});

test.describe("rhythm", () => {
  test("entries are separated by 20px of rhythm, not 16", async ({ page }) => {
    await page.goto("/design");
    const list = page.getByTestId("design-harness").locator(":scope > div").first();
    const gap = await list.evaluate((el) => parseFloat(getComputedStyle(el).rowGap));
    expect(gap).toBe(20);
  });

  test("the reading column is 720px at desktop width", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/design");
    const column = page.getByTestId("design-harness").locator("xpath=..");
    const width = await column.evaluate((el) => el.getBoundingClientRect().width);
    expect(width).toBeGreaterThan(700);
    expect(width).toBeLessThanOrEqual(720);
  });
});
