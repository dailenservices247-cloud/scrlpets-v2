import { expect, test } from "@playwright/test";
import { SELLER_EMAIL, signInCached } from "./fixtures";

/**
 * /market — the merged marketplace.
 *
 * The defect this surface exists to fix: `/shop` filtered
 * `sale AND creature_id IS NULL` and `/adopt` filtered `adoption`, so a SALE
 * listing WITH an animal — the default output of "list my animal" — matched
 * neither and was browsable on no surface at all.
 *
 * This file owns every row it reads. It never borrows a seeded creature: the
 * species filter is an exact match, a shared animal gets hidden, archived or
 * handed over by whatever spec runs in the next worker, and the assertions
 * below are `a[href="/listing/<id>"]` on ids this test created — never counts
 * of global state, never feed placement (density caps make that non-guaranteed).
 */

async function createAnimalFixtures(stamp: number) {
  const { db, userId } = await signInCached(SELLER_EMAIL);
  // A per-run species value so the exact-match filter can only ever return the
  // two listings below, whatever else is on the shared database.
  const species = `e2e-species-${stamp}`;

  const { data: creature, error: creatureError } = await db
    .from("creatures")
    .insert({
      owner_id: userId,
      name: `E2E market animal ${stamp}`,
      slug: `e2e-market-animal-${stamp}`,
      species,
      page_visible: true,
    })
    .select("id")
    .single();
  expect(creatureError).toBeNull();

  // Phase 2 gate: an animal listing needs the animal attested by its owner.
  await db.rpc("attest_animal_eligibility", { target_creature: creature!.id });

  const sale = await db
    .from("listings")
    .insert({
      seller_id: userId,
      title: `E2E market sale ${stamp}`,
      price_cents: 120000,
      creature_id: creature!.id,
      listing_kind: "sale",
    })
    .select("id")
    .single();
  expect(sale.error).toBeNull();

  const adoption = await db
    .from("listings")
    .insert({
      seller_id: userId,
      title: `E2E market adoption ${stamp}`,
      price_cents: 5000,
      creature_id: creature!.id,
      listing_kind: "adoption",
    })
    .select("id")
    .single();
  expect(adoption.error).toBeNull();

  return {
    db,
    species,
    creatureId: creature!.id as string,
    saleId: sale.data!.id as string,
    adoptionId: adoption.data!.id as string,
  };
}

/** Asserted teardown — listings only ever soft-delete, animals archive. */
async function cleanup(f: Awaited<ReturnType<typeof createAnimalFixtures>>) {
  for (const id of [f.saleId, f.adoptionId]) {
    const removed = await f.db.rpc("soft_delete_managed_listing", { target_listing_id: id });
    expect(removed, `soft-deleting listing ${id}`).toMatchObject({ data: true, error: null });
  }
  const archived = await f.db.rpc("archive_creature", {
    target_creature: f.creatureId,
    archived: true,
  });
  expect(archived.error, "archiving the test animal").toBeNull();
}

test("an animal for sale is browsable on /market — the hole /shop and /adopt left", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const f = await createAnimalFixtures(Date.now());

  try {
    // Guest: browsing is public (G1-A). The species filter scopes the page to
    // exactly this test's two rows.
    await page.context().clearCookies();
    await page.goto(`/market?tab=animals&species=${encodeURIComponent(f.species)}`);

    // BOTH intents on one surface. The sale row is the one that was homeless.
    await expect(page.locator(`a[href="/listing/${f.saleId}"]`)).toHaveCount(1, {
      timeout: 20_000,
    });
    await expect(page.locator(`a[href="/listing/${f.adoptionId}"]`)).toHaveCount(1);

    // The Supplies tab is still products-only: an animal listing never leaks in.
    await page.goto("/market?tab=supplies");
    await expect(page.locator(`a[href="/listing/${f.saleId}"]`)).toHaveCount(0);
    await expect(page.locator(`a[href="/listing/${f.adoptionId}"]`)).toHaveCount(0);
  } finally {
    await cleanup(f);
  }
});

test("intent and species filters live in the URL and survive a reload", async ({ page }) => {
  test.setTimeout(120_000);
  const f = await createAnimalFixtures(Date.now());

  try {
    await page.context().clearCookies();
    await page.goto("/market");

    // Driven through the form, as a person would: species + intent, then submit.
    await page.getByTestId("market-filter-species").fill(f.species);
    await page.getByTestId("market-filter-intent").selectOption("adoption");
    await page.getByTestId("market-filter-submit").click();

    // Content assertions auto-retry, so by the time these pass the form's GET
    // navigation has committed — safe to read page.url() afterwards.
    await expect(page.locator(`a[href="/listing/${f.adoptionId}"]`)).toHaveCount(1, {
      timeout: 20_000,
    });
    await expect(page.locator(`a[href="/listing/${f.saleId}"]`)).toHaveCount(0);
    // Parsed, not regex-matched: a form encodes a space as "+" where
    // encodeURIComponent produces "%20", a mismatch that says nothing about
    // whether the filter worked.
    const url = new URL(page.url());
    expect(url.searchParams.get("intent")).toBe("adoption");
    expect(url.searchParams.get("species")).toBe(f.species);

    // Reload proves the filter lives in the URL, not in client-side memory.
    await page.reload();
    await expect(page.locator(`a[href="/listing/${f.adoptionId}"]`)).toHaveCount(1);
    await expect(page.locator(`a[href="/listing/${f.saleId}"]`)).toHaveCount(0);

    // And the shared link works cold, in the other direction.
    await page.goto(
      `/market?tab=animals&intent=sale&species=${encodeURIComponent(f.species)}`,
    );
    await expect(page.locator(`a[href="/listing/${f.saleId}"]`)).toHaveCount(1, {
      timeout: 20_000,
    });
    await expect(page.locator(`a[href="/listing/${f.adoptionId}"]`)).toHaveCount(0);
  } finally {
    await cleanup(f);
  }
});

test("the merged routes redirect to their tab instead of 404ing", async ({ page }) => {
  test.setTimeout(120_000);
  await page.context().clearCookies();

  for (const [from, expected] of [
    ["/shop", "supplies"],
    ["/adopt", "animals"],
    ["/services", "services"],
  ] as const) {
    await page.goto(from);
    await expect(page.getByTestId(`market-tab-${expected}`)).toHaveAttribute(
      "aria-current",
      "page",
      { timeout: 20_000 },
    );
    expect(new URL(page.url()).pathname).toBe("/market");
  }

  // The adoption intent survives the move rather than dumping into "any".
  await page.goto("/adopt");
  await expect(page.getByTestId("market-filter-intent")).toHaveValue("adoption");

  // And a category filter is carried across, not dropped.
  await page.goto("/shop?category=E2E%20gear");
  expect(new URL(page.url()).searchParams.get("category")).toBe("E2E gear");
});

// The bottom-nav slot itself is asserted in navigation.spec.ts, which owns nav.
test("the offer entry is ungated", async ({ page }) => {
  await page.context().clearCookies();

  // Signed OUT, with no brand and no animals: the entry a groomer could never
  // find is on the page, and the chooser behind it is not capability-gated.
  await page.goto("/market");
  await expect(page.getByTestId("market-offer-entry")).toHaveAttribute("href", "/market/offer");
  await page.goto("/market/offer");
  for (const key of ["animal", "supplies", "service", "litter"]) {
    await expect(page.getByTestId(`offer-option-${key}`)).toBeVisible();
  }
});
