import { expect, test } from "@playwright/test";
import { SELLER_EMAIL, SELLER_PROFILE_ID, signInCached } from "./fixtures";

/**
 * A breeder between litters has nothing to list, so the expecting litter is the
 * only thing they can publish — and it is worth publishing only if a visitor can
 * raise a hand from it.
 *
 * ApplyPanel has rendered waitlist mode since it was written (`listingId` null,
 * `waitlistTitle` copy, a buyer_applications row with a null listing). No page
 * has ever passed null, so that half has never rendered in production.
 *
 * The litter is created and removed by this test: dev carries no litters, and
 * globalSetup's marker cleanup covers posts and listings only.
 */
test("an expecting litter invites a visitor onto the breeder's waitlist", async ({ page }) => {
  const { db } = await signInCached(SELLER_EMAIL);

  const { data: litter, error } = await db
    .from("litters")
    .insert({
      owner_id: SELLER_PROFILE_ID,
      name: `E2E expecting ${Date.now()}`,
      species: "dog",
      status: "expecting",
    })
    .select("id")
    .single();
  expect(error, error?.message).toBeNull();
  const litterId = litter!.id as string;

  try {
    await page.goto(`/litters/${litterId}`);

    const panel = page.getByTestId("apply-panel");
    await expect(panel).toBeVisible();
    // Waitlist mode, not apply mode: proves the page passed a null listing.
    await expect(panel).toContainText("Join the waitlist");
  } finally {
    await db.from("litters").delete().eq("id", litterId);
  }
});
