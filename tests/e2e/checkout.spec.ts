import { test, expect } from "@playwright/test";
import { SELLER_EMAIL, MEMBER_EMAIL, signInCached } from "./fixtures";

async function loginViaUi(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
}

/**
 * Checkout renders while payments are OFF, which is the state it will live in
 * until the flag flips. It has to be honest in that state rather than broken:
 * the flow is walkable, the total is visible, and the reason nothing can be
 * bought is stated instead of the button silently failing.
 */
test.describe("checkout", () => {
  test.describe.configure({ timeout: 120_000 });

  test("shows the fulfilment choice, the real total, and why buying is off", async ({ page }) => {
    const { db, userId } = await signInCached(SELLER_EMAIL);
    const stamp = Date.now();
    const listing = await db
      .from("listings")
      .insert({
        seller_id: userId,
        title: `E2E checkout ${stamp}`,
        price_cents: 120000,
        deposit_bps: 1500,
        inspection_hours: 48,
      })
      .select("id")
      .single();
    expect(listing.error).toBeNull();
    const listingId = listing.data!.id;

    // A BUYER, not the seller — a seller is redirected off their own checkout.
    await loginViaUi(page, MEMBER_EMAIL);
    await page.goto(`/checkout/${listingId}`);

    // All three fulfilment modes are offered: they release money differently and
    // the buyer picks which one applies.
    await expect(page.getByTestId("fulfilment-in_person")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("fulfilment-transported")).toBeVisible();
    await expect(page.getByTestId("fulfilment-shipped")).toBeVisible();

    await expect(page.getByTestId("checkout-summary")).toContainText("$1,200.00");
    // 15% of $1200, shown as part of the price rather than added on top.
    await expect(page.getByTestId("line-deposit")).toContainText("$180.00");
    // The seller's own window, not a hardcoded 24.
    await expect(page.getByTestId("checkout-summary")).toContainText("48 hours");

    // Honest about the flag, and the button cannot be pressed into a failure.
    await expect(page.getByTestId("checkout-payments-off")).toBeVisible();
    await expect(page.getByTestId("checkout-place-order")).toBeDisabled();

    await db.from("listings").delete().eq("id", listingId);
  });

  test("transport asks for the route before offering any driver", async ({ page }) => {
    const { db, userId } = await signInCached(SELLER_EMAIL);
    const stamp = Date.now();
    const listing = await db
      .from("listings")
      .insert({ seller_id: userId, title: `E2E checkout route ${stamp}`, price_cents: 90000 })
      .select("id")
      .single();
    const listingId = listing.data!.id;

    await loginViaUi(page, MEMBER_EMAIL);
    await page.goto(`/checkout/${listingId}`);

    await expect(page.getByTestId("checkout-transport")).toHaveCount(0);
    await page.getByTestId("fulfilment-transported").check();
    await expect(page.getByTestId("checkout-transport")).toBeVisible();

    // No drivers are listed until a route exists — coverage is a function of the
    // route, and a list shown beforehand would advertise drivers who cannot
    // finish the journey.
    await expect(page.getByTestId("checkout-transport-options")).toHaveCount(0);
    await expect(page.getByTestId("checkout-find-transport")).toBeDisabled();

    await page.getByTestId("checkout-from-region").fill("OH");
    await page.getByTestId("checkout-to-region").fill("MI");
    await expect(page.getByTestId("checkout-find-transport")).toBeEnabled();

    await db.from("listings").delete().eq("id", listingId);
  });

  test("a seller is sent away from their own checkout", async ({ page }) => {
    const { db, userId } = await signInCached(SELLER_EMAIL);
    const stamp = Date.now();
    const listing = await db
      .from("listings")
      .insert({ seller_id: userId, title: `E2E checkout own ${stamp}`, price_cents: 50000 })
      .select("id")
      .single();
    const listingId = listing.data!.id;

    await loginViaUi(page, SELLER_EMAIL);
    await page.goto(`/checkout/${listingId}`);
    await expect(page).toHaveURL(new RegExp(`/listing/${listingId}$`), { timeout: 20_000 });

    await db.from("listings").delete().eq("id", listingId);
  });

  test("signed-out is sent to login", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/checkout/00000000-0000-0000-0000-000000000999");
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
