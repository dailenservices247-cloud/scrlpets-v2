import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("email").fill(process.env.E2E_EMAIL!);
  await page.getByPlaceholder("password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
});

test("feed shows all 5 content types + creature awareness", async ({ page }) => {
  for (const t of ["post", "reel", "long_video", "listing", "promo"]) {
    await expect(page.getByTestId(`tile-${t}`).first()).toBeVisible();
    await expect(page.getByTestId(`content-type-${t}`).first()).toBeVisible();
  }
  await expect(page.getByTestId("creature-name").first()).toBeVisible();
  await expect(page.getByTestId("listing-summary").first()).toBeVisible();
  await expect(page.getByTestId("product-summary").first()).toBeVisible();
});

test("each feed type opens its destination surface", async ({ page }) => {
  const cases = [
    ["post", /\/post\//],
    ["reel", /\/watch\/reel\//],
    ["long_video", /\/watch\//],
    ["listing", /\/listing\//],
    ["promo", /\/shop\/product\//],
  ] as const;

  for (const [type, url] of cases) {
    await page.goto("/");
    await page.getByTestId(`tile-destination-${type}`).first().click();
    await expect(page).toHaveURL(url);
    await expect(page.getByTestId(`destination-${type}`)).toBeVisible();
    await expect(page.getByTestId("destination-heading")).toBeVisible();
    await expect(page.getByTestId(`content-type-${type}`)).toBeVisible();
    if (type === "listing") {
      await expect(page.getByTestId("listing-detail-summary")).toBeVisible();
    }
    if (type === "promo") {
      await expect(page.getByTestId("product-detail-summary")).toBeVisible();
    }
  }
});

test("Following / For-You toggle updates the url", async ({ page }) => {
  await page.getByRole("tab", { name: "For You" }).click();
  await expect(page).toHaveURL(/tab=for_you/);
});

test("tiles render media images", async ({ page }) => {
  await expect(page.locator('[data-testid="tile-media"]').first()).toBeVisible();
});

test("For You ordering differs from Following", async ({ page }) => {
  const sequence = async () =>
    (await page.locator('[data-testid="feed-list"] > *').allInnerTexts()).join("|");
  const following = await sequence();
  await page.getByRole("tab", { name: "For You" }).click();
  await expect(page).toHaveURL(/tab=for_you/);
  await page.waitForLoadState("networkidle");
  const forYou = await sequence();
  expect(forYou).not.toEqual(following);
});
