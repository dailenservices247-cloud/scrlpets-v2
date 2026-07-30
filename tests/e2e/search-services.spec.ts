import { expect, test } from "@playwright/test";
import { MEMBER_EMAIL, SELLER_EMAIL, signInCached } from "./fixtures";

/**
 * V7-04 search filters, V2-04 saved searches, V3-01 service inquiry.
 * Search is guest-allowed, so the filter test never signs in; saved search
 * and service inquiry both require an identity, signed in through the UI
 * per compose.spec.ts's convention.
 */

test("search filters narrow listings server-side and survive in the URL", async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const titleA = `E2E filter ${stamp} A`;
  const titleB = `E2E filter ${stamp} B`;
  const marker = `E2E filter ${stamp}`;

  const { db: sellerDb, userId: sellerId } = await signInCached(SELLER_EMAIL);

  // Reuse an existing seeded creature (species already set) rather than
  // creating one — a new creature can never be cleaned up afterward, since
  // listings can only be soft-deleted and the FK would still point at it.
  const { data: creature, error: creatureError } = await sellerDb
    .from("creatures")
    .select("id,species")
    .eq("owner_id", sellerId)
    .not("species", "is", null)
    .limit(1)
    .single();
  expect(creatureError).toBeNull();
  const species = creature!.species as string;

  // Phase 2 gate: an animal listing needs the animal attested by its owner.
  await sellerDb.rpc("attest_animal_eligibility", { target_creature: creature!.id });

  const listingA = await sellerDb
    .from("listings")
    .insert({
      seller_id: sellerId,
      title: titleA,
      price_cents: 2500,
      creature_id: creature!.id,
      listing_kind: "adoption",
    })
    .select("id")
    .single();
  expect(listingA.error).toBeNull();

  const listingB = await sellerDb
    .from("listings")
    .insert({ seller_id: sellerId, title: titleB, price_cents: 5000, listing_kind: "sale" })
    .select("id")
    .single();
  expect(listingB.error).toBeNull();

  // Species filter, driven through the UI form: only the animal listing (A)
  // has a creature attached at all, so B is excluded regardless of value.
  await page.goto(`/search?q=${encodeURIComponent(marker)}`);
  await page.getByTestId("search-filter-species").fill(species);
  await page.getByTestId("search-submit").click();
  // Content assertions auto-retry, so by the time these pass the form's GET
  // navigation is guaranteed complete — safe to read page.url() afterward.
  await expect(page.getByTestId("search-listing").filter({ hasText: titleA })).toHaveCount(1, {
    timeout: 15_000,
  });
  await expect(page.getByTestId("search-listing").filter({ hasText: titleB })).toHaveCount(0);
  // Parsed rather than regex-matched: a species value with a space would be
  // form-encoded as "+" but encodeURIComponent produces "%20", a mismatch
  // that has nothing to do with whether the filter actually worked.
  expect(new URL(page.url()).searchParams.get("species")).toBe(species);

  // Reload proves the filter lives in the URL, not client-side memory.
  await page.reload();
  await expect(page.getByTestId("search-listing").filter({ hasText: titleA })).toHaveCount(1);
  await expect(page.getByTestId("search-listing").filter({ hasText: titleB })).toHaveCount(0);

  // Kind filter, driven directly by a shared link: only the product-style
  // listing (B) is "sale" — A is "adoption" and drops out.
  await page.goto(`/search?q=${encodeURIComponent(marker)}&kind=sale`);
  await expect(page).toHaveURL(/kind=sale/);
  await expect(page.getByTestId("search-listing").filter({ hasText: titleB })).toHaveCount(1, {
    timeout: 15_000,
  });
  await expect(page.getByTestId("search-listing").filter({ hasText: titleA })).toHaveCount(0);

  const cleanupA = await sellerDb.rpc("soft_delete_managed_listing", {
    target_listing_id: listingA.data!.id,
  });
  expect(cleanupA).toMatchObject({ data: true, error: null });
  const cleanupB = await sellerDb.rpc("soft_delete_managed_listing", {
    target_listing_id: listingB.data!.id,
  });
  expect(cleanupB).toMatchObject({ data: true, error: null });
});

test("saving a search adds it to the list and deleting removes it", async ({ page }) => {
  test.setTimeout(120_000);
  const marker = `E2E saved search ${Date.now()}`;

  await page.goto("/login");
  await page.getByLabel("Email address").fill(MEMBER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

  await page.goto("/search?q=puppy");
  await page.getByTestId("save-search-trigger").click();
  await page.getByTestId("save-search-name").fill(marker);
  await page.getByTestId("save-search-submit").click();

  const row = page.getByTestId("saved-search-row").filter({ hasText: marker });
  await expect(row).toHaveCount(1, { timeout: 20_000 });

  await row.getByTestId("saved-search-delete").click();
  await expect(row).toHaveCount(0, { timeout: 20_000 });

  // Cleanup MUST be asserted: confirm nothing with this marker survives.
  const { db, userId } = await signInCached(MEMBER_EMAIL);
  const remaining = await db
    .from("saved_searches")
    .select("id")
    .eq("profile_id", userId)
    .eq("name", marker);
  expect(remaining.data ?? []).toEqual([]);
});

test("service inquiry creates one conversation and is idempotent on a second click", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const marker = `E2E svc contact ${Date.now()}`;

  const { db: sellerDb, userId: sellerId } = await signInCached(SELLER_EMAIL);
  const created = await sellerDb
    .from("services")
    .insert({ owner_id: sellerId, name: marker, category: "grooming", price_cents: 4500, active: true })
    .select("id")
    .single();
  expect(created.error).toBeNull();
  const serviceId = created.data!.id as string;

  await page.goto("/login");
  await page.getByLabel("Email address").fill(MEMBER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

  await page.goto("/services");
  const card = page.getByTestId("service-card").filter({ hasText: marker });
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByTestId(`service-contact-${serviceId}`).click();
  await expect(page).toHaveURL(/\/messages\//, { timeout: 20_000 });
  const conversationUrl = page.url();

  const { db: memberDb, userId: memberId } = await signInCached(MEMBER_EMAIL);
  const [a, b] = [sellerId, memberId].sort();
  const countConversations = async () => {
    const { data } = await memberDb.from("conversations").select("id").eq("user_a", a).eq("user_b", b);
    return data?.length ?? 0;
  };
  expect(await countConversations()).toBe(1);

  // Second click: create-or-reuse means no duplicate conversation.
  await page.goto("/services");
  await expect(card).toBeVisible({ timeout: 20_000 });
  await card.getByTestId(`service-contact-${serviceId}`).click();
  await expect(page).toHaveURL(conversationUrl, { timeout: 20_000 });
  expect(await countConversations()).toBe(1);

  const del = await sellerDb
    .from("services")
    .delete({ count: "exact" })
    .eq("owner_id", sellerId)
    .eq("name", marker);
  expect(del.error).toBeNull();
  expect(del.count).toBe(1);
});
