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

/**
 * The chips were changed by the micro-tier pass and the baselines did not move
 * — not because the change was small, but because no fixture ever rendered
 * them: every item had createdAt equal to updatedAt, no group and no pinnedAt.
 * A screenshot gate that cannot see an element is not protecting it, so these
 * assert the chips are actually on the page before the baselines claim to
 * cover them.
 */
test.describe("the chips are in the harness at all", () => {
  const chips = ["edited-chip", "pinned-chip", "group-chip"] as const;

  for (const chip of chips) {
    test(`${chip} renders on /design`, async ({ page }) => {
      await page.goto("/design");
      await expect(page.getByTestId(chip).first()).toBeVisible();
    });
  }

  test("chip text comes from the micro role, not a raw pixel size", async ({ page }) => {
    await page.goto("/design");
    const size = await page
      .getByTestId("edited-chip")
      .first()
      .evaluate((el) => parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBe(11);
  });
});

/**
 * §3.3's third register. Immersive is the one the spec says already exists —
 * "already the reel realm's language (shipped F6)" — but §4 assigns it to the
 * reel IN FEED too, and there the tile was still a panel: a card with a
 * wine-bright border, the caption stacked above the video and the actions in a
 * row underneath. The behaviour (inline portrait, mute on the video, no CTA)
 * shipped; the surface did not.
 *
 * Measured against /design so the fixture never moves, same as the registers
 * above. The reel fixture carries social context and canManage precisely so the
 * rail and the owner menu render here — a gate that cannot see an element is
 * not protecting it.
 */
test.describe("immersive register", () => {
  const box = (locator: Locator) => locator.evaluate((el) => el.getBoundingClientRect());

  test("a reel tile has no card under it — the media is the tile", async ({ page }) => {
    await page.goto("/design");
    const tile = page.getByTestId("tile-reel").first();
    await expect(tile).toBeVisible();
    const surface = await tile.evaluate((el) => {
      const s = getComputedStyle(el);
      return { border: parseFloat(s.borderTopWidth), shadow: s.boxShadow };
    });
    expect(surface.border, "immersive has no border").toBe(0);
    expect(surface.shadow, "immersive has no card shadow").toBe("none");
  });

  test("the media spans the whole tile, with no inset around it", async ({ page }) => {
    await page.goto("/design");
    const tile = page.getByTestId("tile-reel").first();
    const media = tile.locator('[data-testid="tile-media-video"], [data-testid="tile-media"]').first();
    await expect(media).toBeVisible();
    const [t, m] = [await box(tile), await box(media)];
    expect(Math.abs(m.width - t.width), `tile ${t.width}px vs media ${m.width}px`).toBeLessThanOrEqual(1);
  });

  test("identity and caption ride a gradient scrim", async ({ page }) => {
    await page.goto("/design");
    const scrim = page.getByTestId("tile-reel").first().getByTestId("reel-scrim");
    await expect(scrim).toBeVisible();
    const bg = await scrim.evaluate((el) => getComputedStyle(el).backgroundImage);
    expect(bg, `scrim background was ${bg}`).toContain("gradient");
    // Both, because a scrim carrying only one of them is the panel's header in
    // a different position rather than the immersive register.
    await expect(scrim).toContainText("Ridgeline Ranch");
    await expect(scrim).toContainText("losing a fight with a leaf");
  });

  test("the actions sit on a right rail, over the media", async ({ page }) => {
    await page.goto("/design");
    const tile = page.getByTestId("tile-reel").first();
    const rail = tile.getByTestId("reel-rail");
    await expect(rail).toBeVisible();
    const [t, r] = [await box(tile), await box(rail)];
    const railCentre = r.x + r.width / 2;
    expect(railCentre, "the rail is on the right half").toBeGreaterThan(t.x + t.width / 2);
  });

  test("no CTA button — the media itself is the doorway", async ({ page }) => {
    await page.goto("/design");
    const tile = page.getByTestId("tile-reel").first();
    await expect(tile.getByTestId("reel-open-link")).toHaveCount(0);
    await expect(tile.getByTestId("tile-destination-reel")).toHaveCount(0);
    await expect(tile.getByTestId("reel-open")).toBeVisible();
  });

  test("the mute toggle stays on the video", async ({ page }) => {
    await page.goto("/design");
    await expect(
      page.getByTestId("tile-reel").first().getByTestId("tile-mute-toggle"),
    ).toBeVisible();
  });

  test("an owner can still manage the reel from the feed", async ({ page }) => {
    // Dropping FeedCardShell drops the header that owned this control, so it
    // has to be put back deliberately rather than noticed missing in prod.
    await page.goto("/design");
    await expect(
      page.getByTestId("tile-reel").first().getByTestId("owner-menu"),
    ).toBeVisible();
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
