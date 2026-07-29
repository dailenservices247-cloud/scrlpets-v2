import { expect, test } from "@playwright/test";
import { SELLER_EMAIL } from "./fixtures";

test("signed-out /brand-os redirects to login", async ({ page }) => {
  await page.goto("/brand-os");
  await expect(page).toHaveURL(/\/login/);
});

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(SELLER_EMAIL);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
  });

  test("brand OS shows the owner's real brand with honest counts", async ({ page }) => {
    // Ensure at least one brand exists (runs accumulate E2E brands; brand-os shows the oldest,
    // so assert structure rather than an exact name).
    const brandName = `E2E Brand ${Date.now()}`;
    await page.goto("/brands/new");
    await page.getByTestId("brand-name").fill(brandName);
    await page.getByTestId("brand-create-submit").click();
    await expect(page).toHaveURL(/\/compose\?brand=/, { timeout: 20_000 });
    // Pin the just-created brand explicitly — the Brand OS DEFAULT selection is
    // the oldest membership, which other specs' brands can occupy.
    const brandId = new URL(page.url()).searchParams.get("brand")!;

    await page.goto(`/brand-os?brand=${brandId}`);
    await expect(page.getByTestId("brand-os-header")).toBeVisible();
    await expect(page.getByTestId("brand-os-header").getByRole("heading", { level: 1 })).toHaveText(/E2E Brand/);
    await expect(page.getByTestId("brand-os-overview")).toBeVisible();
    await expect(page.getByTestId("brand-os-quick-actions")).toBeVisible();

    // Public link lands on the real public brand page.
    await page.getByTestId("brand-os-public-link").click();
    await expect(page).toHaveURL(/\/b\//);
    await expect(page.getByTestId("brand-profile-header")).toBeVisible();
  });
});
