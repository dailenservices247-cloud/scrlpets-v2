import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { SELLER_EMAIL } from "./fixtures";

test("signed-out /litters shows a sign-in prompt", async ({ page }) => {
  await page.goto("/litters");
  await expect(page.getByTestId("litters-signin-prompt")).toBeVisible();
});

test.describe("signed in", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  const stamp = Date.now();
  const litterMarker = `E2E litter ${stamp}`;
  const descriptionMarker = `E2E description ${stamp}`;
  const updatedDescription = `E2E updated description ${stamp}`;
  const youngMarker1 = `E2E young ${stamp}`;
  const youngMarker2 = `E2E young2 ${stamp}`;

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(SELLER_EMAIL);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
  });

  test("full wizard create (all 4 steps) → litter appears in the list and its public page renders", async ({
    page,
  }) => {
    await page.goto("/litters");
    await page.getByTestId("record-litter-cta").click();
    await expect(page.getByTestId("litter-wizard")).toBeVisible();

    // Step 1 — basics.
    await page.getByTestId("litter-name").fill(litterMarker);
    await page.getByTestId("litter-species").selectOption("dog");
    await page.getByTestId("litter-breed").fill("Labrador Retriever");
    await page.getByTestId("litter-description").fill(descriptionMarker);
    await page.getByTestId("litter-status").selectOption("expecting");
    await page.getByTestId("wizard-next").click();

    // Step 2 — parents. The fixture seller has no breeding-role animals yet; leave both as None.
    await expect(page.getByTestId("litter-dam")).toBeVisible();
    await expect(page.getByTestId("litter-sire")).toBeVisible();
    await page.getByTestId("wizard-next").click();

    // Step 3 — young: inline-add one.
    await page.getByTestId("young-add-name").fill(youngMarker1);
    await page.getByTestId("young-add-gender").selectOption("female");
    await page.getByTestId("young-add-confirm").click();
    await expect(page.getByTestId("young-pending-row").filter({ hasText: youngMarker1 })).toBeVisible();
    await page.getByTestId("wizard-next").click();

    // Step 4 — review + save.
    await expect(page.getByTestId("litter-review")).toContainText(litterMarker);
    await page.getByTestId("wizard-save").click();
    await expect(page.getByTestId("litter-wizard")).not.toBeVisible();

    const card = page.getByTestId("litter-card").filter({ hasText: litterMarker });
    await expect(card).toBeVisible();

    await card.getByTestId("litter-open").click();
    await expect(page).toHaveURL(/\/litters\//);
    await expect(page.getByTestId("litter-public-name")).toHaveText(litterMarker);
    await expect(page.getByTestId("litter-public-description")).toHaveText(descriptionMarker);
    await expect(page.getByTestId("litter-young-card").filter({ hasText: youngMarker1 })).toBeVisible();
  });

  test("edit roundtrip loads existing values, updates the description, and adds a second young", async ({
    page,
  }) => {
    await page.goto("/litters");
    const card = page.getByTestId("litter-card").filter({ hasText: litterMarker });
    await expect(card).toBeVisible();
    await card.getByTestId("litter-edit").click();

    // Legacy's edit opened a blank form and crashed on publish — this is the
    // acceptance check in reverse: the wizard must load the existing values.
    await expect(page.getByTestId("litter-wizard")).toBeVisible();
    await expect(page.getByTestId("litter-name")).toHaveValue(litterMarker);
    await expect(page.getByTestId("litter-breed")).toHaveValue("Labrador Retriever");
    await expect(page.getByTestId("litter-description")).toHaveValue(descriptionMarker);

    await page.getByTestId("litter-description").fill(updatedDescription);
    await page.getByTestId("wizard-next").click(); // step 2
    await page.getByTestId("wizard-next").click(); // step 3

    // Add a second young inline; the first young (linked in the previous test) stays checked.
    await page.getByTestId("young-add-name").fill(youngMarker2);
    await page.getByTestId("young-add-gender").selectOption("male");
    await page.getByTestId("young-add-confirm").click();
    await page.getByTestId("wizard-next").click(); // step 4

    await page.getByTestId("wizard-save").click();
    await expect(page.getByTestId("litter-wizard")).not.toBeVisible();

    await card.getByTestId("litter-open").click();
    await expect(page.getByTestId("litter-public-description")).toHaveText(updatedDescription);
    await expect(page.getByTestId("litter-young-card").filter({ hasText: youngMarker1 })).toBeVisible();
    await expect(page.getByTestId("litter-young-card").filter({ hasText: youngMarker2 })).toBeVisible();
  });

  test("delete via UI confirm removes it from the list; cleanup hides the young it created", async ({
    page,
  }) => {
    await page.goto("/litters");
    const card = page.getByTestId("litter-card").filter({ hasText: litterMarker });
    await expect(card).toBeVisible();
    await card.getByTestId("litter-delete").click();

    await expect(page.getByTestId("litter-delete-dialog")).toBeVisible();
    await page.getByTestId("litter-delete-confirm").click();
    await expect(page.getByTestId("litter-delete-dialog")).not.toBeVisible();
    await expect(page.getByTestId("litter-card").filter({ hasText: litterMarker })).toHaveCount(0);

    // Cleanup MUST be asserted — a silent no-op left content on a public
    // surface once already (see tests/e2e/compose.spec.ts). The litter row
    // itself is gone; hide the young it created via inline-add.
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const auth = await db.auth.signInWithPassword({
      email: SELLER_EMAIL,
      password: process.env.E2E_PASSWORD!,
    });
    const userId = auth.data.user!.id;
    const mine = await db
      .from("creatures")
      .select("id")
      .eq("owner_id", userId)
      .in("name", [youngMarker1, youngMarker2]);
    expect(mine.data?.length).toBe(2);
    const hide = await db
      .from("creatures")
      .update({ page_visible: false }, { count: "exact" })
      .eq("owner_id", userId)
      .in("name", [youngMarker1, youngMarker2]);
    expect(hide.count).toBe(2);
  });
});
