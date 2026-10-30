import { expect, test } from "@playwright/test";
import { MEMBER_EMAIL, SELLER_EMAIL, signInCached } from "./fixtures";

test("Option A: interactive service booking flow from service card to deal room negotiation", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const password = process.env.E2E_PASSWORD!;
  const stamp = Date.now();
  const serviceName = `E2E Training & Conditioning ${stamp}`;

  // 1. Seller creates a bookable service with tiers and deposit
  const { db: sellerDb, userId: sellerId } = await signInCached(SELLER_EMAIL);

  const { data: service, error: serviceError } = await sellerDb
    .from("services")
    .insert({
      owner_id: sellerId,
      name: serviceName,
      category: "training",
      price_cents: 15000,
      area: "Columbus, OH",
      booking_enabled: true,
      deposit_required: true,
      deposit_amount_cents: 5000,
      service_tier_rates: [
        { id: `t1-${stamp}`, name: "Basic Evaluation", priceCents: 7500, description: "1-hour assessment" },
        { id: `t2-${stamp}`, name: "Full Conditioning Camp", priceCents: 25000, description: "2-week intensive" },
      ],
      booking_notice: "Current vaccination records required prior to booking confirmation.",
      active: true,
    })
    .select("id,name")
    .single();

  expect(serviceError).toBeNull();
  expect(service).not.toBeNull();
  const serviceId = service!.id;

  try {
    // 2. Buyer (member) signs in
    await page.goto("/login");
    await page.getByLabel("Email address").fill(MEMBER_EMAIL);
    await page.getByLabel("Password").fill(password);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

    // 3. Buyer navigates to market services tab
    await page.goto("/market?tab=services");
    await page.waitForLoadState("networkidle");

    // Locate the service card by service-request-booking test ID or heading
    const bookingBtn = page.getByTestId(`service-request-booking-${serviceId}`);
    await expect(bookingBtn).toBeVisible({ timeout: 15_000 });
    await bookingBtn.click();

    // 4. Modal opens
    const modal = page.getByTestId("booking-request-modal");
    await expect(modal).toBeVisible();
    await expect(modal.getByText(serviceName)).toBeVisible();
    await expect(modal.getByText("Full Conditioning Camp")).toBeVisible();

    // Select the "Full Conditioning Camp" tier
    await modal.getByRole("button", { name: /Full Conditioning Camp/ }).click();

    // Pick a date in the future
    const futureDate = new Date(Date.now() + 7 * 86400000).toISOString().split("T")[0];
    await modal.locator('input[type="date"]').fill(futureDate);

    // Fill animal & notes
    await modal.locator('input[placeholder*="Meech"]').fill("Thor (Presa Canario, 2 yrs)");
    await modal.locator("textarea").fill("Looking forward to the evaluation camp. High drive working dog.");

    // 5. Submit booking request
    await modal.getByTestId("submit-booking-request-btn").click();

    // 6. Verifies navigation to Deal Room / Messages thread
    await expect(page).toHaveURL(/\/messages\/[a-f0-9-]+/, { timeout: 25_000 });

    // 7. Verify the structured booking request message rendered in the thread
    await expect(page.getByText(serviceName)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Full Conditioning Camp")).toBeVisible();
    await expect(page.getByText("Thor (Presa Canario, 2 yrs)")).toBeVisible();
  } finally {
    // Cleanup service
    await sellerDb.from("services").delete().eq("id", serviceId);
  }
});
