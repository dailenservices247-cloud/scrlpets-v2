import { expect, test } from "@playwright/test";
import { SELLER_EMAIL, signInCached } from "./fixtures";

test("signed-out /hub shows a sign-in prompt", async ({ page }) => {
  await page.goto("/hub");
  await expect(page.getByTestId("hub-signin-prompt")).toBeVisible();
});

test.describe("signed in", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(SELLER_EMAIL);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
  });

  test("hub renders the tree/litters/calendar cards and at least one brand card", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const brandName = `E2E Hub Brand ${Date.now()}`;
    await page.goto("/brands/new");
    await page.getByTestId("brand-name").fill(brandName);
    await page.getByTestId("brand-create-submit").click();
    await expect(page).toHaveURL(/\/compose\?brand=/, { timeout: 20_000 });

    await page.goto("/hub");
    await expect(page.getByTestId("hub-stats")).toBeVisible();
    await expect(page.getByTestId("hub-card-tree")).toBeVisible();
    await expect(page.getByTestId("hub-card-litters")).toBeVisible();
    await expect(page.getByTestId("hub-card-calendar")).toBeVisible();
    await expect(
      page.getByTestId("hub-brand-card").filter({ hasText: brandName }),
    ).toBeVisible();
  });

  test("a brand card navigates to brand-os", async ({ page }) => {
    test.setTimeout(120_000);
    const brandName = `E2E Hub Nav Brand ${Date.now()}`;
    await page.goto("/brands/new");
    await page.getByTestId("brand-name").fill(brandName);
    await page.getByTestId("brand-create-submit").click();
    await expect(page).toHaveURL(/\/compose\?brand=/, { timeout: 20_000 });
    const brandId = new URL(page.url()).searchParams.get("brand")!;

    await page.goto("/hub");
    await page.getByTestId("hub-brand-card").filter({ hasText: brandName }).click();
    await expect(page).toHaveURL(new RegExp(`/brand-os\\?brand=${brandId}`), { timeout: 15_000 });
    await expect(page.getByTestId("brand-os-header")).toBeVisible();
  });

  // R2: Brand OS's modules are capability-gated. Force capabilities via the
  // API (proving the gate itself, not just a brand-type default), assert the
  // services panel is gone while a still-granted panel (roster/breeding)
  // stays, then restore.
  test("Brand OS hides the services panel for a brand whose capabilities exclude services", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const brandName = `E2E Capability Brand ${Date.now()}`;
    await page.goto("/brands/new");
    await page.getByTestId("brand-name").fill(brandName);
    await page.getByTestId("brand-create-submit").click();
    await expect(page).toHaveURL(/\/compose\?brand=/, { timeout: 20_000 });
    const brandId = new URL(page.url()).searchParams.get("brand")!;

    const { db } = await signInCached(SELLER_EMAIL);
    const excluded = await db
      .from("brands")
      .update({ capabilities: ["breeding"] }, { count: "exact" })
      .eq("id", brandId);
    expect(excluded.error).toBeNull();
    expect(excluded.count).toBe(1);

    await page.goto(`/brand-os?brand=${brandId}`);
    await expect(page.getByTestId("brand-os-header")).toBeVisible();
    await expect(page.getByTestId("roster-panel")).toBeVisible();
    await expect(page.getByTestId("services-manager")).toHaveCount(0);

    const restored = await db
      .from("brands")
      .update({ capabilities: ["breeding", "selling_animals"] }, { count: "exact" })
      .eq("id", brandId);
    expect(restored.error).toBeNull();
    expect(restored.count).toBe(1);
  });
});
