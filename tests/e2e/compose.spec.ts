import { test, expect } from "@playwright/test";

test("signed-out /compose redirects to login", async ({ page }) => {
  await page.goto("/compose");
  await expect(page).toHaveURL(/\/login/);
});

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("email").fill(process.env.E2E_EMAIL!);
    await page.getByPlaceholder("password").fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");
  });

  test("create text post → appears at top of feed", async ({ page }) => {
    const marker = `E2E post ${Date.now()}`;
    await page.getByTestId("compose-cta").click();
    await page.getByTestId("post-body").fill(marker);
    await page.getByTestId("post-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/");
    await expect(page.getByText(marker)).toBeVisible();
  });

  test("composer alignment exposes identity, mode, subject, and preview", async ({ page }) => {
    await page.goto("/compose?mode=listing");
    await expect(page.getByTestId("composer-alignment")).toBeVisible();
    await expect(page.getByTestId("posting-as-selector")).toBeVisible();
    await expect(page.getByTestId("mode-selector")).toBeVisible();
    await expect(page.getByTestId("about-selector")).toBeVisible();
    await expect(page.getByTestId("attribution-preview")).toBeVisible();
    await expect(page.getByTestId("listing-form")).toBeVisible();
    await page.getByRole("tab", { name: /Product/ }).click();
    await expect(page.getByTestId("planned-mode-panel")).toBeVisible();
  });

  test("create listing with price → appears in feed", async ({ page }) => {
    const marker = `E2E listing ${Date.now()}`;
    await page.goto("/compose");
    await page.getByRole("tab", { name: "Listing" }).click();
    await page.getByTestId("listing-title").fill(marker);
    await page.getByTestId("listing-price").fill("123.45");
    await page.getByTestId("listing-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/");
    await expect(page.getByText(marker)).toBeVisible();
  });

  test("listing rejects junk price", async ({ page }) => {
    await page.goto("/compose");
    await page.getByRole("tab", { name: "Listing" }).click();
    await page.getByTestId("listing-title").fill("x");
    await page.getByTestId("listing-price").fill("abc");
    await page.getByTestId("listing-submit").click();
    await expect(page).toHaveURL(/compose/);
  });
});
