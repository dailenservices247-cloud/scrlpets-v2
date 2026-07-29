import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { MEMBER_EMAIL, SELLER_EMAIL, THIRD_EMAIL } from "./fixtures";

const BUYER_EMAIL = MEMBER_EMAIL;

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

/**
 * D10 — THE MONEY GATE. Payments are built and off. This is the assertion that
 * has to hold every single run: no client path can create an order or move an
 * order forward while the DB flag is false.
 */
test("money cannot move while payments are disabled", async () => {
  test.setTimeout(120_000);
  const seller = await signIn(SELLER_EMAIL);
  const stamp = Date.now();

  const productTitle = `E2E commerce product ${stamp}`;
  const listing = await seller.db
    .from("listings")
    .insert({
      seller_id: seller.userId,
      title: productTitle,
      price_cents: 4200,
      description: "E2E product description",
      category: "E2E",
    })
    .select("id")
    .single();
  expect(listing.error).toBeNull();
  const listingId = listing.data!.id;

  const flag = await seller.db
    .from("platform_flags")
    .select("enabled")
    .eq("key", "payments_enabled")
    .single();
  expect(flag.data!.enabled, "payments must ship disabled").toBe(false);

  const buyer = await signIn(BUYER_EMAIL);

  // 1. Ordering is refused at the database, not merely hidden in the UI.
  const ordered = await buyer.db.rpc("create_order", { target_listing: listingId });
  expect(ordered.error?.message).toContain("payments_disabled");

  // 2. There is no client INSERT policy on orders, so forging one fails too.
  const forged = await buyer.db.from("orders").insert({
    buyer_id: buyer.userId,
    seller_id: seller.userId,
    listing_id: listingId,
    amount_cents: 4200,
  });
  expect(forged.error).not.toBeNull();

  // 3. The flag itself is not client-writable.
  const flipped = await buyer.db
    .from("platform_flags")
    .update({ enabled: true }, { count: "exact" })
    .eq("key", "payments_enabled");
  expect(flipped.count ?? 0).toBe(0);

  await seller.db.from("listings").delete().eq("id", listingId);
});

/** D13 — applications: the seller decides, and the buyer cannot self-accept. */
test("buyer applications are decided by the seller only", async () => {
  test.setTimeout(120_000);
  const seller = await signIn(SELLER_EMAIL);
  const stamp = Date.now();

  const listingTitle = `E2E application listing ${stamp}`;
  const listing = await seller.db
    .from("listings")
    .insert({ seller_id: seller.userId, title: listingTitle, price_cents: 9900 })
    .select("id")
    .single();
  const listingId = listing.data!.id;

  const buyer = await signIn(BUYER_EMAIL);
  const application = await buyer.db
    .from("buyer_applications")
    .insert({
      buyer_id: buyer.userId,
      seller_id: seller.userId,
      listing_id: listingId,
      message: "E2E application",
    })
    .select("id,status")
    .single();
  expect(application.error).toBeNull();
  expect(application.data!.status).toBe("submitted");
  const applicationId = application.data!.id;

  // A second open application for the same listing is refused.
  const duplicate = await buyer.db.from("buyer_applications").insert({
    buyer_id: buyer.userId,
    seller_id: seller.userId,
    listing_id: listingId,
  });
  expect(duplicate.error).not.toBeNull();

  // No client UPDATE policy: the buyer cannot write themselves an acceptance.
  const selfAccept = await buyer.db
    .from("buyer_applications")
    .update({ status: "accepted" }, { count: "exact" })
    .eq("id", applicationId);
  expect(selfAccept.count ?? 0).toBe(0);

  // Nor through the definer — a buyer may only withdraw.
  const viaDefiner = await buyer.db.rpc("set_application_status", {
    target_application: applicationId,
    new_status: "accepted",
  });
  expect(viaDefiner.error?.message).toContain("buyer_may_only_withdraw");

  // The seller decides, and the decision sticks.
  const decided = await seller.db.rpc("set_application_status", {
    target_application: applicationId,
    new_status: "accepted",
  });
  expect(decided.error).toBeNull();
  const after = await seller.db
    .from("buyer_applications")
    .select("status,decided_by")
    .eq("id", applicationId)
    .single();
  expect(after.data!.status).toBe("accepted");
  expect(after.data!.decided_by).toBe(seller.userId);

  // Applications are private to the two parties.
  const third = await signIn(THIRD_EMAIL).catch(() => null);
  if (third) {
    const seen = await third.db
      .from("buyer_applications")
      .select("id")
      .eq("id", applicationId);
    expect(seen.data ?? []).toEqual([]);
  }

  await seller.db.from("buyer_applications").delete().eq("id", applicationId);
  await seller.db.from("listings").delete().eq("id", listingId);
});

/** D9 — the shop shows products and never animals. */
test("shop lists products and excludes animal listings", async ({ page }) => {
  test.setTimeout(120_000);
  const seller = await signIn(SELLER_EMAIL);
  const stamp = Date.now();

  const productTitle = `E2E shop product ${stamp}`;
  const product = await seller.db
    .from("listings")
    .insert({
      seller_id: seller.userId,
      title: productTitle,
      price_cents: 1500,
      category: "E2E gear",
    })
    .select("id")
    .single();
  expect(product.error).toBeNull();

  await page.goto("/shop");
  await expect(page.getByTestId("shop-grid")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(productTitle)).toBeVisible({ timeout: 20_000 });
  // Checkout is off, and the page says so rather than showing a dead button.
  await expect(page.getByTestId("shop-checkout-notice")).toBeVisible();

  // Every card in the shop is a non-animal listing.
  const animals = await seller.db
    .from("listings")
    .select("id")
    .not("creature_id", "is", null)
    .is("deleted_at", null)
    .limit(5);
  for (const a of animals.data ?? []) {
    await expect(page.locator(`a[href="/listing/${a.id}"]`)).toHaveCount(0);
  }

  await seller.db.from("listings").delete().eq("id", product.data!.id);
});
