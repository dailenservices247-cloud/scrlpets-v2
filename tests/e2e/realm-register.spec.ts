import { expect, test, type Locator, type Page } from "@playwright/test";

/**
 * Spec §3.3 and §4: the room is on the same register as the tile that opened
 * it. A listing carries price and state, so its realm is a panel. A post is
 * something someone said, so its realm is an entry in a column with no surface
 * under it at all.
 *
 * Measured on the real destinations rather than the /design harness, because
 * the register of a ROOM is what is under test and the harness only renders
 * tiles. The two tests are each other's control: the same measurement has to
 * come back opposite on the two registers, or it is measuring nothing.
 */
const measure = (locator: Locator) =>
  locator.evaluate((el) => {
    const style = getComputedStyle(el);
    return {
      radius: parseFloat(style.borderTopLeftRadius),
      shadow: style.boxShadow,
      borderWidth: parseFloat(style.borderTopWidth),
      borderColor: style.borderTopColor,
    };
  });

const surfaceOf = (page: Page) => measure(page.getByTestId("destination-surface"));

/**
 * Filtering on the CARD, never the action link: the link's only text is a
 * translated label and an aria-hidden icon, so a hasNotText filter on it
 * excludes nothing. E2E rows are created and soft-deleted by other workers
 * mid-run, so an unfiltered .first() can click a listing that is already gone.
 */
async function openTheListingRealm(page: Page) {
  await page.goto("/");
  const tile = page.getByTestId("tile-listing").filter({ hasNotText: "E2E " }).first();
  // Measured BEFORE the click, because "same register as the tile" is the
  // claim: comparing the room against the tile beats comparing it against a
  // radius written into this file. rounded-2xl is 18px here, not 16 — shadcn
  // derives the scale from --radius — and a hard-coded 16 asserted the
  // assumption instead of the token.
  const tileSurface = await measure(tile);
  await tile.getByTestId("tile-destination-listing").click();
  await expect(page.getByTestId("destination-listing")).toBeVisible({ timeout: 20_000 });
  return tileSurface;
}

/** A post has no CTA — it reads inline (A2). Its doorway is the timestamp. */
async function openThePostRealm(page: Page) {
  await page.goto("/");
  await page
    .getByTestId("tile-post")
    .filter({ hasNotText: "E2E " })
    .first()
    .getByTestId("post-permalink")
    .click();
  await expect(page.getByTestId("destination-post")).toBeVisible({ timeout: 20_000 });
}

test.describe("realm registers", () => {
  test("a listing realm is a panel, like the tile that opened it", async ({ page }) => {
    const tile = await openTheListingRealm(page);
    const surface = await surfaceOf(page);
    expect(surface.radius, "the room's radius is the tile's radius").toBe(tile.radius);
    expect(surface.shadow, "premium-panel carries layered light").not.toBe("none");
    expect(surface.borderWidth).toBeGreaterThan(0);
    // Wine is red-dominant, spine green-dominant. Comparing channels survives
    // whatever opacity the accent is applied at.
    const [r, g] = surface.borderColor.match(/[\d.]+/g)!.map(Number);
    expect(
      r > g,
      `a listing's accent is wine, not the reserved spine. Got ${surface.borderColor}`,
    ).toBe(true);
  });

  test("a post realm is an entry in a column — no box under it", async ({ page }) => {
    await openThePostRealm(page);
    const surface = await surfaceOf(page);
    expect(surface.borderWidth, "editorial has no border").toBe(0);
    expect(surface.shadow, "editorial has no shadow").toBe("none");
  });

  test("a realm heading is display-size, in the identity serif", async ({ page }) => {
    // Spec §3.1 sizes it and §9 assigns the face: a realm heading is an
    // identity string, so it takes Instrument Serif. Measured on the listing
    // realm because that is the one an existing spec proves is reachable.
    await openTheListingRealm(page);
    const heading = page.getByTestId("destination-heading");
    const type = await heading.evaluate((el) => {
      const style = getComputedStyle(el);
      return { size: parseFloat(style.fontSize), family: style.fontFamily };
    });
    expect(type.size, "display is 24px").toBe(24);
    expect(type.family).toContain("Instrument");
  });
});
