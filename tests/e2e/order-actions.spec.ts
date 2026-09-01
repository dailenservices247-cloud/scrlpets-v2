import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { SELLER_EMAIL, MEMBER_EMAIL, signInCached } from "./fixtures";

/**
 * The order page's controls, against a real order.
 *
 * `payments_enabled` is FALSE, so every definer here refuses with
 * `payments_disabled`. That refusal IS the assertion: it proves the button
 * reached the database rather than being swallowed in the client, and it proves
 * the flag is what stops it.
 */
async function loginViaUi(page: import("@playwright/test").Page, email: string) {
  // This spec signs in as TWO people in sequence. Without clearing the session
  // first, the second call lands on a /login that no longer renders a form —
  // the visitor is already authenticated — and `fill` waits out the whole
  // timeout. Matches the pattern every other multi-user spec uses
  // (block-report.spec.ts:13).
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
}

test.describe("order actions", () => {
  test.describe.configure({ timeout: 120_000 });

  // Cleanup CANNOT live on the last line of a test. It did, and two failing
  // runs left `funds_held` orders on shared dev — which then broke the
  // entitlements_and_pause PROBE, because pause_subscription correctly refuses
  // while an order is in flight. A leaked fixture here is not litter, it is a
  // false failure somewhere else entirely. Same defect subject-layer.spec.ts
  // had (fixed in f8d7277).
  const created: { orders: string[]; listings: string[] } = { orders: [], listings: [] };

  test.afterEach(async () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    const asService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    // Orders first: every child (events, messages, payments, payouts, refunds)
    // is ON DELETE CASCADE, so this leaves nothing orphaned.
    if (created.orders.length) await asService.from("orders").delete().in("id", created.orders);
    if (created.listings.length) await asService.from("listings").delete().in("id", created.listings);
    created.orders = [];
    created.listings = [];
  });

  test("a seller sees seller controls and a buyer sees buyer controls", async ({ page }) => {
    test.skip(
      !process.env.SUPABASE_SERVICE_ROLE_KEY,
      "needs SUPABASE_SERVICE_ROLE_KEY; orders are definer-written by design",
    );
    const asService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const seller = await signInCached(SELLER_EMAIL);
    const buyer = await signInCached(MEMBER_EMAIL);
    const stamp = Date.now();

    const listing = await seller.db
      .from("listings")
      .insert({ seller_id: seller.userId, title: `E2E actions ${stamp}`, price_cents: 50000 })
      .select("id")
      .single();
    expect(listing.error, "fixture listing must exist or this proves nothing").toBeNull();
    created.listings.push(listing.data!.id as string);

    const order = await asService
      .from("orders")
      .insert({
        buyer_id: buyer.userId,
        seller_id: seller.userId,
        listing_id: listing.data!.id,
        title_snapshot: `E2E actions ${stamp}`,
        amount_cents: 50000,
        status: "funds_held",
        fulfilment: "in_person",
      })
      .select("id")
      .single();
    // Without this the whole test passes vacuously on a null order id.
    expect(order.error, "fixture order must exist or this proves nothing").toBeNull();
    const orderId = order.data!.id as string;
    created.orders.push(orderId);

    // Seller at funds_held on an in-person order: dispatch, not shipment.
    await loginViaUi(page, SELLER_EMAIL);
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByTestId("order-mark-dispatched")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("order-record-shipment")).toHaveCount(0);
    await expect(page.getByTestId("order-accept-delivery")).toHaveCount(0);

    // The flag is what stops it, and the page says so rather than failing mutely.
    await page.getByTestId("order-mark-dispatched").click();
    await expect(page.getByTestId("order-actions-error")).toContainText(/not live yet/i, {
      timeout: 20_000,
    });

    // Buyer on the same order: no seller controls, and the dispute is theirs too.
    // No signout hop: /auth/signout is POST-only, so navigating to it was a GET
    // against a route with no GET handler and never signed anyone out. The
    // session is cleared inside loginViaUi instead.
    await loginViaUi(page, MEMBER_EMAIL);
    await page.goto(`/orders/${orderId}`);
    await expect(page.getByTestId("order-dispute")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("order-mark-dispatched")).toHaveCount(0);
    await expect(page.getByTestId("order-address-line")).toBeVisible();

  });

  test("a shipped order offers the seller tracking, never a dispatch button", async ({ page }) => {
    test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY");
    const asService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const seller = await signInCached(SELLER_EMAIL);
    const buyer = await signInCached(MEMBER_EMAIL);
    const stamp = Date.now();

    const listing = await seller.db
      .from("listings")
      .insert({ seller_id: seller.userId, title: `E2E shipped ${stamp}`, price_cents: 40000 })
      .select("id")
      .single();
    expect(listing.error, "fixture listing must exist or this proves nothing").toBeNull();
    created.listings.push(listing.data!.id as string);

    const order = await asService
      .from("orders")
      .insert({
        buyer_id: buyer.userId,
        seller_id: seller.userId,
        listing_id: listing.data!.id,
        title_snapshot: `E2E shipped ${stamp}`,
        amount_cents: 40000,
        status: "funds_held",
        fulfilment: "shipped",
      })
      .select("id")
      .single();
    expect(order.error, "fixture order must exist or this proves nothing").toBeNull();
    const orderId = order.data!.id as string;
    created.orders.push(orderId);

    await loginViaUi(page, SELLER_EMAIL);
    await page.goto(`/orders/${orderId}`);

    await expect(page.getByTestId("order-tracking")).toBeVisible({ timeout: 20_000 });
    // mark_dispatched raises on a shipped order — tracking is mandatory there,
    // so offering the button at all would be offering a guaranteed refusal.
    await expect(page.getByTestId("order-mark-dispatched")).toHaveCount(0);

  });
});
