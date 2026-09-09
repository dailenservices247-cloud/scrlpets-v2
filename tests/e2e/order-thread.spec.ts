import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { SELLER_EMAIL, MEMBER_EMAIL, signInCached } from "./fixtures";

async function loginViaUi(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
}

test.describe("order thread", () => {
  test.describe.configure({ timeout: 120_000 });

  // Cleanup CANNOT live on the last line of a test. It did, and order 6ed07d8c
  // sat in `funds_held` on shared dev from 2026-09-07 -- there is no client
  // DELETE on orders, so nothing else was ever going to reclaim it. A leaked
  // fixture here is not litter, it is a false failure somewhere else: that row
  // is what turned the entitlements_and_pause probe red, because
  // pause_subscription correctly refuses while an order is in flight. Same
  // defect order-actions.spec.ts had (fixed in 141a9cd) and subject-layer.spec
  // before it (f8d7277).
  const created: { orders: string[]; listings: string[] } = { orders: [], listings: [] };

  test.afterEach(async () => {
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
    const asService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    // Orders first: order_messages and every other child is ON DELETE CASCADE
    // (20260812131120_order_thread.sql:22), so this leaves nothing orphaned and
    // needs no separate sweep of the thread.
    if (created.orders.length) await asService.from("orders").delete().in("id", created.orders);
    if (created.listings.length) await asService.from("listings").delete().in("id", created.listings);
    created.orders = [];
    created.listings = [];
  });

  test("a non-party gets a 404, not a permission message", async ({ page }) => {
    // A "you don't have access" page confirms the order exists. A 404 does not.
    await loginViaUi(page, MEMBER_EMAIL);
    await page.goto("/orders/00000000-0000-0000-0000-0000000009ff");
    await expect(page.getByText(/404|not found/i).first()).toBeVisible({ timeout: 20_000 });
  });

  test("parties talk in one thread, and every message carries a ROLE", async ({ page }) => {
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
      .insert({ seller_id: seller.userId, title: `E2E thread ${stamp}`, price_cents: 50000 })
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
        amount_cents: 50000,
        status: "funds_held",
      })
      .select("id")
      .single();
    expect(order.error, "fixture order must exist or this proves nothing").toBeNull();
    const orderId = order.data!.id as string;
    created.orders.push(orderId);

    await loginViaUi(page, MEMBER_EMAIL);
    await page.goto(`/orders/${orderId}`);

    await expect(page.getByTestId("thread-empty")).toBeVisible({ timeout: 20_000 });
    // Two parties on this order, so it says two — not a generic "everyone".
    await expect(page.getByTestId("thread-who")).toContainText(/seller/i);

    await page.getByTestId("thread-input").fill("When can I collect?");
    await page.getByTestId("thread-send").click();

    await expect(page.getByTestId("thread-messages")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("thread-messages")).toContainText("When can I collect?");
    // The role is what a dispute needs months later, not just a username.
    await expect(page.getByTestId("thread-messages")).toContainText(/buyer/i);
    // Stated once, plainly: this is evidence.
    await expect(page.getByTestId("order-thread")).toContainText(/can't be edited or deleted/i);
  });

  test("signed-out is sent to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/orders/00000000-0000-0000-0000-0000000009ff");
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
