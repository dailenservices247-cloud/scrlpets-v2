import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { SELLER_EMAIL } from "./fixtures";

/**
 * A bird lays a clutch. `/c/[slug]` called it a litter for every species, and
 * nothing caught it: the dog-shaped-vocabulary regex in `pack-alumni-ui.spec.ts`
 * runs only on the alumni surface, and `litters.spec.ts` creates a DOG — for
 * which "litter" is correct, so it could never discriminate.
 *
 * The species must be one whose word is NOT "litter", or the spec cannot
 * discriminate: a dog's litter is a litter, so a dog fixture passes against the
 * broken build. Verified RED before the fix — the page rendered the raw key
 * `creature.fromLitter` because next-intl refused the missing parameter.
 */
test.describe("species-correct young-group vocabulary", () => {
  test.describe.configure({ mode: "serial", timeout: 90_000 });

  const stamp = Date.now();
  const litterMarker = `E2E aviary ${stamp}`;
  const youngMarker = `E2E young aviary ${stamp}`;

  test("an aviary's young page says clutch, never litter", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(SELLER_EMAIL);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });

    await page.goto("/litters");
    await page.getByTestId("record-litter-cta").click();
    await page.getByTestId("litter-name").fill(litterMarker);
    await page.getByTestId("litter-species").selectOption("bird");
    await page.getByTestId("litter-status").selectOption("born");
    await page.getByTestId("wizard-next").click();
    await page.getByTestId("wizard-next").click();

    // The young inherits the litter's species server-side, so this creature is
    // a bird without the client ever asserting so.
    await page.getByTestId("young-add-name").fill(youngMarker);
    await page.getByTestId("young-add-gender").selectOption("female");
    await page.getByTestId("young-add-confirm").click();
    await page.getByTestId("wizard-next").click();
    await page.getByTestId("wizard-save").click();
    await expect(page.getByTestId("litter-wizard")).not.toBeVisible();

    const card = page.getByTestId("litter-card").filter({ hasText: litterMarker });
    await card.getByTestId("litter-open").click();
    await page
      .getByTestId("litter-young-card")
      .filter({ hasText: youngMarker })
      .getByRole("link", { name: youngMarker })
      .click();
    await expect(page).toHaveURL(/\/c\//);

    const link = page.getByTestId("creature-litter-link");
    await expect(link).toBeVisible();
    await expect(link).toContainText("clutch");
    await expect(link).not.toContainText(/litter/i);
    await expect(link).not.toContainText("{group}");
  });

  test("cleanup: the bird litter and its young leave nothing behind", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(SELLER_EMAIL);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });

    await page.goto("/litters");
    const card = page.getByTestId("litter-card").filter({ hasText: litterMarker });
    await card.getByTestId("litter-delete").click();
    await page.getByTestId("litter-delete-confirm").click();
    await expect(page.getByTestId("litter-card").filter({ hasText: litterMarker })).toHaveCount(0);

    // Asserted, not fire-and-forget: a silent no-op left content on a public
    // surface once already (tests/e2e/compose.spec.ts).
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    const auth = await db.auth.signInWithPassword({
      email: SELLER_EMAIL,
      password: process.env.E2E_PASSWORD!,
    });
    const userId = auth.data.user!.id;
    const hide = await db
      .from("creatures")
      .update({ page_visible: false }, { count: "exact" })
      .eq("owner_id", userId)
      .eq("name", youngMarker);
    expect(hide.count).toBe(1);
  });
});
