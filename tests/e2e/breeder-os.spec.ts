import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function databaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function signIn(email: string) {
  const db = databaseClient();
  const auth = await db.auth.signInWithPassword({
    email,
    password: process.env.E2E_PASSWORD!,
  });
  return { db, userId: auth.data.user!.id };
}

async function signInBrowser(page: import("@playwright/test").Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
}

/**
 * R16 — the operating surface renders its modules, and the readiness list is
 * a checklist of real checks. Legacy scored trust 0-100 with 20 points for a
 * premium subscription; nothing here may be completable by paying.
 */
test("brand-os shows operating modules and no purchasable trust score", async ({ page }) => {
  test.setTimeout(120_000);
  await signInBrowser(page, process.env.E2E_EMAIL!);
  await page.goto("/brand-os");

  await expect(page.getByTestId("readiness-panel")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("roster-panel")).toBeVisible();
  await expect(page.getByTestId("seller-listings-panel")).toBeVisible();
  await expect(page.getByTestId("breeder-stats-panel")).toBeVisible();

  // Every readiness step is a real check. None of them mention paying.
  for (const key of ["identity", "program", "animals", "records", "listing"]) {
    await expect(page.getByTestId(`readiness-${key}`)).toBeVisible();
  }
  const readiness = await page.getByTestId("readiness-panel").innerText();
  expect(readiness.toLowerCase()).not.toContain("premium");
  expect(readiness.toLowerCase()).not.toContain("subscri");
  expect(readiness.toLowerCase()).not.toContain("upgrade");
  // No 0-100 trust score anywhere on the surface.
  expect(readiness).not.toMatch(/\b\d{1,3}\s*(\/\s*100|%)/);
});

/** Availability is seller-controlled, and only by the actual seller. */
test("listing availability is controlled by its seller only", async () => {
  test.setTimeout(120_000);
  const seller = await signIn(process.env.E2E_EMAIL!);
  const stamp = Date.now();

  const listing = await seller.db
    .from("listings")
    .insert({ seller_id: seller.userId, title: `E2E availability ${stamp}`, price_cents: 2000 })
    .select("id,availability")
    .single();
  expect(listing.error).toBeNull();
  expect(listing.data!.availability).toBe("available");
  const listingId = listing.data!.id;

  const sold = await seller.db
    .from("listings")
    .update({ availability: "sold" }, { count: "exact" })
    .eq("id", listingId);
  expect(sold.count).toBe(1);

  // A different signed-in member cannot flip somebody else's listing back.
  const other = await signIn("scrlpets-rbac-e2e@scrlpets.com");
  const hijack = await other.db
    .from("listings")
    .update({ availability: "available" }, { count: "exact" })
    .eq("id", listingId);
  expect(hijack.count ?? 0).toBe(0);

  const after = await seller.db
    .from("listings")
    .select("availability")
    .eq("id", listingId)
    .single();
  expect(after.data!.availability).toBe("sold");

  await seller.db.from("listings").delete().eq("id", listingId);
});

/** The stats panel counts real rows — it never invents a number. */
test("breeder stats match the operator's actual records", async ({ page }) => {
  test.setTimeout(120_000);
  const seller = await signIn(process.env.E2E_EMAIL!);
  const { count: listingCount } = await seller.db
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("seller_id", seller.userId)
    .is("deleted_at", null);

  await signInBrowser(page, process.env.E2E_EMAIL!);
  await page.goto("/brand-os");
  await expect(page.getByTestId("stat-listings")).toBeVisible({ timeout: 20_000 });
  // The panel caps its query at 100; compare against the same ceiling.
  const shown = Number(await page.getByTestId("stat-listings").innerText());
  expect(shown).toBe(Math.min(listingCount ?? 0, 100));
});
