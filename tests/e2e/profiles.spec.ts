import { test, expect } from "@playwright/test";

test("guest views a profile: tabs, posts, pets → creature page", async ({ page }) => {
  await page.goto("/u/breeder_jane");
  await expect(page.getByTestId("profile-header")).toBeVisible();
  await expect(page.getByTestId("feed-list")).toBeVisible();
  await page.getByTestId("ptab-pets").click();
  await expect(page).toHaveURL(/tab=pets/);
  await expect(page.getByTestId("pets-list")).toBeVisible();
  await page.getByTestId("pets-list").getByText("Max", { exact: true }).click();
  await expect(page).toHaveURL(/\/c\/max-c1/);
  await expect(page.getByTestId("creature-header")).toBeVisible();
  await expect(page.getByTestId("feed-list")).toBeVisible();
});

test("unknown username 404s", async ({ page }) => {
  const res = await page.goto("/u/nonexistent_user_xyz");
  expect(res!.status()).toBe(404);
});

test("feed creature link navigates to creature page", async ({ page }) => {
  await page.goto("/");
  await page.getByTestId("creature-name").first().click();
  await expect(page).toHaveURL(/\/c\//);
  await expect(page.getByTestId("creature-header")).toBeVisible();
});

test("profile edit roundtrip (bio appears on About)", async ({ page }) => {
  const marker = `Trusted breeder since 2020 — ${Date.now()}`;
  await page.goto("/login");
  await page.getByPlaceholder("email").fill(process.env.E2E_EMAIL!);
  await page.getByPlaceholder("password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await page.goto("/settings/profile");
  await page.getByTestId("edit-bio").fill(marker);
  await page.getByTestId("edit-save").click();
  await expect(page).toHaveURL(/\/u\/breeder_jane\?tab=about/);
  await expect(page.getByText(marker)).toBeVisible();
});

test("signed-out /settings redirects to login", async ({ page }) => {
  await page.goto("/settings/profile");
  await expect(page).toHaveURL(/\/login/);
});
