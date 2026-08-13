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

/**
 * A booked driver's screen. The address rule is the part worth pinning: the job
 * is visible before the buyer pays, the ADDRESS is not. People breed at home,
 * and a stranger who can name a booking should not be able to harvest where the
 * animals sleep.
 */
test.describe("transport jobs", () => {
  test.describe.configure({ timeout: 120_000 });

  test("a driver with no bookings is told so, not shown a blank page", async ({ page }) => {
    await loginViaUi(page, MEMBER_EMAIL);
    await page.goto("/jobs");
    await expect(page.getByTestId("jobs-empty")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("jobs-empty")).toContainText(/once the buyer has paid/i);
  });

  test("the route shows before payment; the address does not", async ({ page }) => {
    // orders has NO client insert policy — only definers write it, which is the
    // point. The fixture therefore needs the service role, and the test skips
    // rather than passing vacuously when it is absent.
    test.skip(
      !process.env.SUPABASE_SERVICE_ROLE_KEY,
      "needs SUPABASE_SERVICE_ROLE_KEY; orders are definer-written by design",
    );
    const asService = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const seller = await signInCached(SELLER_EMAIL);
    const driver = await signInCached(MEMBER_EMAIL);
    const stamp = Date.now();

    const listing = await seller.db
      .from("listings")
      .insert({ seller_id: seller.userId, title: `E2E job ${stamp}`, price_cents: 90000 })
      .select("id")
      .single();
    expect(listing.error).toBeNull();

    // Unpaid: awaiting_payment, so addresses_visible is false.
    const order = await asService
      .from("orders")
      .insert({
        buyer_id: driver.userId === seller.userId ? seller.userId : driver.userId,
        seller_id: seller.userId,
        listing_id: listing.data!.id,
        amount_cents: 90000,
        transport_cents: 7500,
        transporter_id: driver.userId,
        fulfilment: "transported",
        status: "awaiting_payment",
        pickup_region: "OH",
        delivery_region: "MI",
        pickup_address: "1 Kennel Road, Columbus OH",
        delivery_address: "9 Buyer Lane, Detroit MI",
      })
      .select("id")
      .single();

    // The order insert is only possible for a party; if the fixture cannot make
    // one, say so rather than passing an empty assertion.
    expect(order.error, "fixture order must exist for this test to mean anything").toBeNull();
    const orderId = order.data!.id;

    await loginViaUi(page, MEMBER_EMAIL);
    await page.goto("/jobs");

    const card = page.getByTestId(`job-${orderId}`);
    await expect(card).toBeVisible({ timeout: 20_000 });
    // Route and fee are known immediately — enough to plan around.
    await expect(card).toContainText("OH");
    await expect(card).toContainText("MI");
    await expect(card).toContainText("$75.00");

    // The address is withheld, and SAYS it is withheld rather than rendering a gap.
    await expect(page.getByTestId(`job-addresses-hidden-${orderId}`)).toBeVisible();
    await expect(page.getByTestId(`job-addresses-${orderId}`)).toHaveCount(0);
    await expect(card).not.toContainText("Kennel Road");

    // No delivery action before the seller has released the animal.
    await expect(page.getByTestId(`job-deliver-${orderId}`)).toHaveCount(0);

    await asService.from("orders").delete().eq("id", orderId);
    await seller.db.from("listings").delete().eq("id", listing.data!.id);
  });

  test("signed-out cannot reach jobs", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/jobs");
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
