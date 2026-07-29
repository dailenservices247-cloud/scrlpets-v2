import { createClient } from "@supabase/supabase-js";
import { expect, test, type Page } from "@playwright/test";
import { SELLER_EMAIL } from "./fixtures";

/**
 * Creature page phase 2 (memorial/about/health tests/lineage) + the brand
 * identity kit. Per-worker fixtures throughout (SELLER_EMAIL), matching the
 * account-collision fix documented in fixtures.ts.
 *
 * Setup for anything not itself under test goes through a direct Supabase
 * call signed in as the seller ("the API"), not the UI — same principle the
 * brand kit case names explicitly (the panel isn't mounted anywhere yet).
 * The behavior actually being verified (adding a test, marking/unmarking a
 * memorial, editing details) always goes through the real UI.
 */

const PASSWORD = process.env.E2E_PASSWORD!;

async function apiAsSeller() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const { data, error } = await supabase.auth.signInWithPassword({
    email: SELLER_EMAIL,
    password: PASSWORD,
  });
  if (error || !data.user) throw new Error(`seller sign-in failed: ${error?.message}`);
  return { supabase, userId: data.user.id };
}

async function loginAsSeller(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(PASSWORD);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
}

let sellerClient: Awaited<ReturnType<typeof apiAsSeller>>["supabase"];
let sellerId: string;
let creatureSlug: string;

test.beforeAll(async () => {
  const seller = await apiAsSeller();
  sellerClient = seller.supabase;
  sellerId = seller.userId;

  // A fresh throwaway creature per run — sidesteps any per-worker slug
  // coordination entirely (mirrors brand-os.spec.ts's "brands accumulate"
  // precedent; there is no delete-creature action to clean this up with).
  const marker = Date.now();
  const { data, error } = await sellerClient
    .from("creatures")
    .insert({ owner_id: sellerId, name: `E2E Creature ${marker}`, species: "Dog", slug: `e2e-creature-${marker}` })
    .select("slug")
    .single();
  if (error || !data) throw new Error(`test creature setup failed: ${error?.message}`);
  creatureSlug = data.slug;
});

test.describe("creature page phase 2", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeller(page);
  });

  test("owner adds a health test via UI; the public card shows the result badge and the self-reported label", async ({
    page,
    browser,
  }) => {
    await page.goto(`/c/${creatureSlug}`);
    await expect(page.getByTestId("health-tests")).toBeVisible();

    const conditionName = `E2E Condition ${Date.now()}`;
    const before = await page.getByTestId("health-test-card").count();

    await page.getByTestId("health-test-add-open").click();
    await expect(page.getByTestId("health-test-dialog")).toBeVisible();
    await page.getByTestId("test-input-type").selectOption("hip");
    await page.getByTestId("test-input-condition").fill(conditionName);
    await page.getByTestId("test-input-result").selectOption("clear");
    await page.getByTestId("test-save").click();
    await expect(page.getByTestId("health-test-dialog")).toBeHidden();

    const card = page.getByTestId("health-test-card").filter({ hasText: conditionName });
    await expect(card).toBeVisible();
    await expect(card.getByTestId("health-test-result-badge")).toHaveText("Clear");
    await expect(page.getByTestId("health-tests-disclaimer")).toContainText("Self-reported by the owner");

    // Cross-session: a signed-out visitor gets the same public card — this is
    // what makes it a genuinely PUBLIC list rather than an owner-only view.
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    await guestPage.goto(`/c/${creatureSlug}`);
    const guestCard = guestPage.getByTestId("health-test-card").filter({ hasText: conditionName });
    await expect(guestCard).toBeVisible();
    await expect(guestCard.getByTestId("health-test-result-badge")).toHaveText("Clear");
    await expect(guestPage.getByTestId("health-tests-disclaimer")).toContainText("Self-reported by the owner");
    await guestContext.close();

    // Cleanup asserted: delete what we added and confirm the count reverts.
    await card.getByTestId("health-test-delete").click();
    await expect(page.getByTestId("health-test-delete-dialog")).toBeVisible();
    await page.getByTestId("health-test-delete-confirm").click();
    await expect(page.getByTestId("health-test-delete-dialog")).toBeHidden();
    await expect(page.getByTestId("health-test-card").filter({ hasText: conditionName })).toHaveCount(0);
    await expect(page.getByTestId("health-test-card")).toHaveCount(before);
  });

  test("memorial mark via UI shows the banner and message, then unmark reverses it", async ({ page }) => {
    await page.goto(`/c/${creatureSlug}`);
    await expect(page.getByTestId("memorial-mark-open")).toBeVisible();
    await expect(page.getByTestId("memorial-banner")).toHaveCount(0);

    const message = `E2E memorial message ${Date.now()}`;
    await page.getByTestId("memorial-mark-open").click();
    await expect(page.getByTestId("memorial-mark-dialog")).toBeVisible();
    await page.getByTestId("memorial-date-input").fill("2020-01-01");
    await page.getByTestId("memorial-message-input").fill(message);
    await page.getByTestId("memorial-mark-confirm").click();
    await expect(page.getByTestId("memorial-mark-dialog")).toBeHidden();

    await expect(page.getByTestId("memorial-banner")).toBeVisible();
    await expect(page.getByTestId("memorial-message")).toContainText(message);

    // The reversibility acceptance: unmark makes the banner disappear entirely.
    await page.getByTestId("memorial-unmark-open").click();
    await expect(page.getByTestId("memorial-unmark-dialog")).toBeVisible();
    await page.getByTestId("memorial-unmark-confirm").click();
    await expect(page.getByTestId("memorial-unmark-dialog")).toBeHidden();
    await expect(page.getByTestId("memorial-banner")).toHaveCount(0);
    await expect(page.getByTestId("memorial-mark-open")).toBeVisible();
  });

  test("edit-details roundtrip: changing color reflects on the page, then reverts", async ({ page }) => {
    await page.goto(`/c/${creatureSlug}`);
    const newColor = `Brindle-E2E-${Date.now()}`;

    await page.getByTestId("about-edit-open").click();
    await expect(page.getByTestId("about-edit-dialog")).toBeVisible();
    await page.getByTestId("about-input-color").fill(newColor);
    await page.getByTestId("about-save").click();
    await expect(page.getByTestId("about-edit-dialog")).toBeHidden();
    await expect(page.getByTestId("about-value-color")).toHaveText(newColor);

    // Restore: clear the field back out so the fixture creature is left as found.
    await page.getByTestId("about-edit-open").click();
    await expect(page.getByTestId("about-edit-dialog")).toBeVisible();
    await page.getByTestId("about-input-color").fill("");
    await page.getByTestId("about-save").click();
    await expect(page.getByTestId("about-edit-dialog")).toBeHidden();
    await expect(page.getByTestId("about-value-color")).toHaveCount(0);
  });
});

test.describe("brand kit", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsSeller(page);
  });

  test("tagline and founded date set via the API as the brand owner render on the public brand page", async ({
    page,
  }) => {
    // The panel isn't mounted anywhere yet, so this exercises the render
    // path directly: write through Supabase as the owner, then assert /b/[slug].
    const marker = Date.now();
    await page.goto("/brands/new");
    await page.getByTestId("brand-name").fill(`E2E Kit Brand ${marker}`);
    await page.getByTestId("brand-create-submit").click();
    await expect(page).toHaveURL(/\/compose\?brand=/, { timeout: 20_000 });
    const brandId = new URL(page.url()).searchParams.get("brand")!;

    const tagline = `E2E tagline ${marker}`;
    const { data: brandRow, error } = await sellerClient
      .from("brands")
      .update({ tagline, founded_on: "2015-06-01" })
      .eq("id", brandId)
      .select("slug")
      .single();
    if (error || !brandRow) throw new Error(`brand kit update failed: ${error?.message}`);

    await page.goto(`/b/${brandRow.slug}`);
    await expect(page.getByTestId("brand-tagline")).toHaveText(tagline);
    await expect(page.getByTestId("brand-established")).toContainText("2015");
  });
});
