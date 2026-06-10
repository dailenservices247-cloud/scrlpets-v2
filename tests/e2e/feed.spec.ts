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
  }
  await expect(page.getByTestId("creature-name").first()).toBeVisible();
});

test("Following / For-You toggle updates the url", async ({ page }) => {
  await page.getByRole("tab", { name: "For You" }).click();
  await expect(page).toHaveURL(/tab=for_you/);
});

test("tiles render media images", async ({ page }) => {
  await expect(page.locator('[data-testid="tile-media"]').first()).toBeVisible();
});

test("For You ordering differs from Following", async ({ page }) => {
  const firstFollowing = await page.locator('[data-testid="feed-list"] > *').first().innerText();
  await page.getByRole("tab", { name: "For You" }).click();
  await expect(page).toHaveURL(/tab=for_you/);
  const firstForYou = await page.locator('[data-testid="feed-list"] > *').first().innerText();
  expect(firstForYou).not.toEqual(firstFollowing);
});
