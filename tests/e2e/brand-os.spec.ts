import { expect, test } from "@playwright/test";

test("signed-out /brand-os redirects to login", async ({ page }) => {
  await page.goto("/brand-os");
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

  test("brand OS shows the owner's real brand with honest counts", async ({ page }) => {
    const brandName = `E2E Brand ${Date.now()}`;
    await page.goto("/brands/new");
    await page.getByTestId("brand-name").fill(brandName);
    await page.getByTestId("brand-create-submit").click();
    await expect(page).toHaveURL(/\/compose/);

    await page.goto("/brand-os");
    await expect(page.getByTestId("brand-os-header")).toBeVisible();
    await expect(page.getByTestId("brand-os-header").getByRole("heading", { name: brandName })).toBeVisible();
    await expect(page.getByTestId("brand-os-overview")).toBeVisible();
    await expect(page.getByTestId("brand-os-quick-actions")).toBeVisible();
  });
});
