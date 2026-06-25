import { expect, test } from "@playwright/test";

test("brand OS dashboard is reachable from the brand profile", async ({ page }) => {
  await page.goto("/b/blue-river-kennels");
  await page.getByTestId("brand-profile-header").getByRole("link", { name: "OS" }).click();
  await expect(page).toHaveURL(/\/brand-os/);
  await expect(page.getByTestId("brand-os-header")).toBeVisible();
  await expect(page.getByTestId("brand-os-header").getByRole("heading", { name: "Blue River Kennels" })).toBeVisible();
  await expect(page.getByTestId("brand-os-overview")).toBeVisible();
  await expect(page.getByTestId("brand-os-quick-actions")).toBeVisible();
  await expect(page.getByTestId("brand-os-attention")).toBeVisible();
  await expect(page.getByTestId("brand-os-modules")).toBeVisible();
  await expect(page.getByTestId("brand-os-attribution")).toBeVisible();
});
