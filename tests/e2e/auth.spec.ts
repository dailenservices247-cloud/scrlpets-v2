import { test, expect } from "@playwright/test";

test("signed-out user sees the public feed + sign-in CTA (G1-A)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("feed-list")).toBeVisible();
  await expect(page.getByTestId("signin-cta")).toBeVisible();
  await expect(page.getByTestId("bottom-nav")).toBeVisible();
});

test("email sign-in lands on the feed", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("email").fill(process.env.E2E_EMAIL!);
  await page.getByPlaceholder("password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(page.getByTestId("feed-list")).toBeVisible();
  await expect(page.getByTestId("signin-cta")).toHaveCount(0);
});

test("app shell routes expose menu and shop surfaces", async ({ page }) => {
  await page.goto("/menu");
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("menu-profile-card")).toBeVisible();
  await expect(page.getByTestId("bottom-nav")).toBeVisible();

  await page.goto("/shop");
  await expect(page.getByTestId("shop-placeholder")).toBeVisible();
  await expect(page.getByTestId("bottom-nav")).toBeVisible();
});
