import { expect, test, type Locator } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
    const body = page.getByTestId("post-body-text").first();
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

test.describe("brand house compliance", () => {
  // Wine is red-dominant (#7e303a), spine is green-dominant (#2a6055). Comparing
  // channels is mechanical and survives any opacity the tint is applied at.
  const channels = async (locator: Locator) => {
    const color = await locator.evaluate((el) => getComputedStyle(el).backgroundColor);
    const [r, g, b] = color.match(/[\d.]+/g)!.map(Number);
    return { r, g, b, color };
  };

  test("a feed tile's action is wine, not the reserved spine", async ({ page }) => {
    await page.goto("/design");
    const cta = page.getByTestId("tile-destination-listing").first();
    await expect(cta).toBeVisible();
    const { r, g, color } = await channels(cta);
    expect(
      r > g,
      `Brand House §7 reserves spine for trust/verification. Got ${color}`,
    ).toBe(true);
  });
});

test.describe("media policy", () => {
  test("portrait media is capped at 4:5 so one photo cannot own the screen", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/design");
    // The third post carries the portrait fixture (3:4, taller than the cap).
    const media = page.getByTestId("tile-post").nth(2).getByTestId("tile-media");
    await expect(media).toBeVisible();
    const box = (await media.boundingBox())!;
    expect(box.height).toBeLessThanOrEqual(box.width * 1.25 + 1);
  });
});

test.describe("baselines", () => {
  // Fixture content is fixed, so a diff here means the design moved — which is
  // the only reason a screenshot test is worth its flake budget. These are the
  // repo's first: they are authoritative on this machine only, so regenerate
  // them if the suite ever moves to hosted CI.
  test("phone", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/design");
    await page.getByTestId("tile-promo").waitFor();
    await expect(page).toHaveScreenshot("feed-390.png", {
      maxDiffPixelRatio: 0.02,
      fullPage: true,
    });
  });

  test("desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto("/design");
    await page.getByTestId("tile-promo").waitFor();
    await expect(page).toHaveScreenshot("feed-1440.png", {
      maxDiffPixelRatio: 0.02,
      fullPage: true,
    });
  });

  test("no serious or critical accessibility violations", async ({ page }) => {
    await page.goto("/design");
    const results = await new AxeBuilder({ page }).analyze();
    const bad = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(bad.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
  });
});
