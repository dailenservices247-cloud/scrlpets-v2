import { test, expect } from "@playwright/test";
import { SELLER_EMAIL } from "./fixtures";

test("signed-out /compose redirects to login", async ({ page }) => {
  await page.goto("/compose");
  await expect(page).toHaveURL(/\/login/);
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

  test("create text post → appears at top of feed", async ({ page }) => {
    const marker = `E2E post ${Date.now()}`;
    await page.getByTestId("compose-cta").click();
    await page.getByTestId("post-body").fill(marker);
    await page.getByTestId("post-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
    await expect(page.getByText(marker)).toBeVisible();
  });

  test("composer alignment exposes identity, mode, subject, and preview", async ({ page }) => {
    await page.goto("/compose?mode=listing");
    await expect(page.getByTestId("composer-alignment")).toBeVisible();
    // Options are collapsed by default (A9 quick-post); expand them first.
    await page.getByTestId("composer-more-options").click();
    await expect(page.getByTestId("posting-as-selector")).toBeVisible();
    await expect(page.getByTestId("mode-selector")).toBeVisible();
    await expect(page.getByTestId("about-selector")).toBeVisible();
    await expect(page.getByTestId("attribution-preview")).toBeVisible();
    await expect(page.getByTestId("listing-form")).toBeVisible();
    await page.getByTestId("mode-selector").getByRole("button", { name: /Product/ }).click();
    await expect(page.getByTestId("planned-mode-panel")).toBeVisible();
  });

  test("create listing with price → appears in feed", async ({ page }) => {
    const marker = `E2E listing ${Date.now()}`;
    await page.goto("/compose");
    await page.getByRole("button", { name: /Listing/ }).click();
    await page.getByTestId("listing-title").fill(marker);
    await page.getByTestId("listing-price").fill("123.45");
    await page.getByTestId("listing-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
    await expect(page.getByText(marker)).toBeVisible();
  });

  test("listing rejects junk price", async ({ page }) => {
    await page.goto("/compose");
    await page.getByRole("button", { name: /Listing/ }).click();
    await page.getByTestId("listing-title").fill("x");
    await page.getByTestId("listing-price").fill("abc");
    await page.getByTestId("listing-submit").click();
    await expect(page).toHaveURL(/compose/);
  });

  test("create brand → post as that brand → appears in feed", async ({ page }) => {
    const brandName = `E2E Brand ${Date.now()}`;
    const marker = `E2E brandpost ${Date.now()}`;

    await page.goto("/brands/new");
    await page.getByTestId("brand-name").fill(brandName);
    await page.getByTestId("brand-create-submit").click();
    await expect(page).toHaveURL(/\/compose/);

    // Switch identity to Brand; the new brand is auto-selected in the picker.
    await page.getByTestId("posting-as-selector").getByRole("button", { name: "Brand" }).click();
    await expect(page.getByTestId("brand-select")).toBeVisible();
    await expect(page.getByTestId("post-submit")).toBeEnabled();

    await page.getByTestId("post-body").fill(marker);
    await page.getByTestId("post-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
    await expect(page.getByText(marker)).toBeVisible();

    // Attribution is clickable → real public brand page with the post on it.
    await page.getByTestId("brand-attribution").filter({ hasText: brandName }).first().click();
    await expect(page).toHaveURL(/\/b\//);
    await expect(page.getByTestId("brand-profile-header").getByRole("heading", { name: brandName })).toBeVisible();
    await expect(page.getByText(marker)).toBeVisible();
  });
});

test("group member posts into a group from the main composer", async ({ page }) => {
  test.setTimeout(120_000);
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const auth = await db.auth.signInWithPassword({
    email: SELLER_EMAIL,
    password: process.env.E2E_PASSWORD!,
  });
  const userId = auth.data.user!.id;
  // Idempotent join of a seeded group so the composer has one to offer.
  const { data: group } = await db
    .from("groups")
    .select("id,slug,name")
    .eq("slug", "german-shepherds")
    .single();
  await db.from("group_memberships").insert({ group_id: group!.id, profile_id: userId });

  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

  const marker = `E2E groupcompose ${Date.now()}`;
  await page.goto("/compose");
  await page.getByTestId("post-body").fill(marker);
  await page.getByTestId("post-group-select").selectOption({ label: group!.name });
  await page.getByTestId("post-submit").click();

  // A group post lands on the group timeline, not the home feed.
  await expect(page).toHaveURL(/\/groups\/german-shepherds/, { timeout: 20_000 });
  await expect(page.getByText(marker)).toBeVisible();

  // Cleanup MUST be asserted — a silent no-op left reviews on a public
  // profile once already. Soft delete hides the row from every timeline.
  const { data: mine } = await db
    .from("posts")
    .select("id")
    .eq("author_id", userId)
    .eq("body", marker)
    .single();
  const del = await db.rpc("soft_delete_managed_post", { target_post_id: mine!.id });
  expect(del.error).toBeNull();
  expect(del.data).toBe(true);
});
