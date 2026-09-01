import { test, expect } from "@playwright/test";
import { SELLER_EMAIL } from "./fixtures";

/**
 * The seeded launch walks every breeder down this path, so BOTH exits are
 * asserted. The skip is the one that matters: a skip that strands someone in
 * an empty app is the failure this whole slice exists to prevent.
 */
test.describe("breeder branch", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  test("skipping the branch lands in the app, not on a dead end", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(SELLER_EMAIL);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

    await page.goto("/onboarding/breeder");
    await expect(page.getByTestId("onboarding-breeder")).toBeVisible();
    await page.getByTestId("breeder-skip").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
  });

  test("the branch offers a named page and does not demand one", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(SELLER_EMAIL);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

    await page.goto("/onboarding/breeder");
    await page.getByTestId("breeder-yes").click();
    await expect(page.getByTestId("breeder-name")).toBeVisible();
    // Empty name must not submit. Asserting the field is still visible does NOT
    // discriminate — verified by removing the client guard, after which
    // createBrand rejects the empty name server-side, no redirect happens, and
    // the field stays visible anyway. The button's state is what differs: the
    // guard returns BEFORE setBusy(true), so it stays enabled; without it the
    // round trip leaves it disabled forever.
    await page.getByTestId("breeder-create").click();
    await expect(page.getByTestId("breeder-name")).toBeVisible();
    await expect(page.getByTestId("breeder-create")).toBeEnabled();
  });
});
