import { expect, test, type Page } from "@playwright/test";
import { MEMBER_EMAIL, SELLER_EMAIL, signInCached } from "./fixtures";

const TITLE_PREFIX = "E2E adoption depth";

async function loginViaUi(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
}

/**
 * V2-03 end to end: structured adoption fields render truthfully (a real
 * false, never hidden, and a real unknown, never read as no), then the
 * screening application carries the buyer's structured answers all the way
 * to the seller's /applications review.
 */
test("adoption depth: honest chips, then the screening application reaches the seller", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const seller = await signInCached(SELLER_EMAIL);
  const buyer = await signInCached(MEMBER_EMAIL);
  const stamp = Date.now();
  const title = `${TITLE_PREFIX} ${stamp}`;

  // Pre-clean: idx_one_open_application is scoped to (buyer_id, listing_id)
  // and every run's listing_id is fresh, so this constraint can never be hit
  // across runs — but a previous crashed run still leaves a live "submitted"
  // row that would otherwise linger as dead evidence. Decline anything
  // tagged with our own title prefix before starting.
  const staleListings = await seller.db
    .from("listings")
    .select("id")
    .eq("seller_id", seller.userId)
    .ilike("title", `${TITLE_PREFIX}%`);
  const staleIds = (staleListings.data ?? []).map((l) => l.id as string);
  if (staleIds.length > 0) {
    const staleApps = await seller.db
      .from("buyer_applications")
      .select("id")
      .in("listing_id", staleIds)
      .eq("status", "submitted");
    for (const row of staleApps.data ?? []) {
      await seller.db.rpc("set_application_status", {
        target_application: row.id,
        new_status: "declined",
      });
    }
  }

  // Seller's animal: a dog well clear of the eight-week rule (see
  // pack-alumni-spine.spec.ts), then attested so the listing insert clears
  // Phase 2's gate.
  const creature = await seller.db
    .from("creatures")
    .insert({
      owner_id: seller.userId,
      name: `E2E adoption depth animal ${stamp}`,
      slug: `e2e-adoption-depth-${stamp}`,
      species: "Dog",
      birth_date: "2025-01-01",
      weaned_date: "2025-03-01",
    })
    .select("id")
    .single();
  expect(creature.error).toBeNull();
  const creatureId = creature.data!.id;
  const attest = await seller.db.rpc("attest_animal_eligibility", {
    target_creature: creatureId,
  });
  expect(attest.error).toBeNull();

  // The adoption listing, with the structured fields set via the API — a
  // true, a false, AND an unknown (null) on each of the two chip rows, so
  // the render assertions below exercise all three states honestly.
  const listing = await seller.db
    .from("listings")
    .insert({
      seller_id: seller.userId,
      title,
      price_cents: 20000,
      creature_id: creatureId,
      listing_kind: "adoption",
      adoption_spayed_neutered: true,
      adoption_vaccinated: false,
      adoption_microchipped: null,
      adoption_good_with_kids: true,
      adoption_good_with_dogs: false,
      adoption_good_with_cats: null,
      adoption_reason: `E2E reason ${stamp}`,
      adoption_special_needs: `E2E special needs ${stamp}`,
    })
    .select("id")
    .single();
  expect(listing.error).toBeNull();
  const listingId = listing.data!.id;

  // Chips render truthfully as a guest: true, a real false (never hidden),
  // and a real unknown (never read as no) — plus the reason/special-needs
  // blocks, since both are present.
  await page.goto(`/listing/${listingId}`);
  // Adoption depth renders on the one listing detail page — there is no
  // separate /adopt/[id] surface.
  await expect(page.getByTestId("adoption-health-panel")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("adoption-chip-spayedNeutered")).toContainText("Spayed");
  await expect(page.getByTestId("adoption-chip-vaccinated")).toContainText("Not vaccinated");
  await expect(page.getByTestId("adoption-chip-microchipped")).toContainText(/unknown/i);
  await expect(page.getByTestId("adoption-chip-goodWithKids")).toContainText("Good with kids");
  await expect(page.getByTestId("adoption-chip-goodWithDogs")).toContainText("Not good with");
  await expect(page.getByTestId("adoption-chip-goodWithCats")).toContainText(/unknown/i);
  await expect(page.getByTestId("adoption-reason")).toContainText(`E2E reason ${stamp}`);
  await expect(page.getByTestId("adoption-special-needs")).toContainText(
    `E2E special needs ${stamp}`,
  );

  // Buyer applies through the UI with the structured screening questions.
  await loginViaUi(page, MEMBER_EMAIL);
  await page.goto(`/listing/${listingId}`);
  const message = `E2E why adopt ${stamp}`;
  const otherPets = `E2E other pets ${stamp}`;
  await page.getByTestId("adoption-message").fill(message);
  await page.getByTestId("adoption-living-situation").selectOption("apartment");
  await page.getByTestId("adoption-has-yard").check();
  await page.getByTestId("adoption-other-pets").fill(otherPets);
  await page.getByTestId("adoption-experience-level").selectOption("some_experience");
  await page.getByTestId("adoption-application-submit").click();
  await expect(page.getByTestId("application-open")).toBeVisible({ timeout: 20_000 });

  const applicationRow = await seller.db
    .from("buyer_applications")
    .select("id,living_situation,has_yard,other_pets,experience_level,message,status")
    .eq("listing_id", listingId)
    .eq("buyer_id", buyer.userId)
    .single();
  expect(applicationRow.error).toBeNull();
  expect(applicationRow.data).toMatchObject({
    living_situation: "apartment",
    has_yard: true,
    other_pets: otherPets,
    experience_level: "some_experience",
    message,
    status: "submitted",
  });
  const applicationId = applicationRow.data!.id as string;

  // Seller sees those structured answers on /applications, alongside the
  // message, before ever touching accept/decline (untouched here).
  await loginViaUi(page, SELLER_EMAIL);
  await page.goto("/applications");
  const row = page.getByTestId(`adoption-screening-${applicationId}`);
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row).toContainText(message);
  await expect(page.getByTestId(`adoption-screening-living-${applicationId}`)).toContainText(
    "Apartment",
  );
  await expect(page.getByTestId(`adoption-screening-yard-${applicationId}`)).toContainText("Yes");
  await expect(page.getByTestId(`adoption-screening-pets-${applicationId}`)).toContainText(
    otherPets,
  );
  await expect(page.getByTestId(`adoption-screening-experience-${applicationId}`)).toContainText(
    "Some experience",
  );

  // Cleanup — asserted. buyer_applications has no client DELETE policy at
  // all (see archive-withdraw.spec.ts / pack-alumni-spine.spec.ts for the
  // same invariant), so decline-via-definer is the only real "delete"; the
  // listing is soft-deleted and the creature hidden rather than removed, for
  // the same reason pack-alumni-spine.spec.ts's cleanup does the same.
  const decline = await seller.db.rpc("set_application_status", {
    target_application: applicationId,
    new_status: "declined",
  });
  expect(decline.error).toBeNull();
  const noDelete = await seller.db
    .from("buyer_applications")
    .delete({ count: "exact" })
    .eq("id", applicationId);
  expect(noDelete.count).toBe(0);

  const softDeleted = await seller.db.rpc("soft_delete_managed_listing", {
    target_listing_id: listingId,
  });
  expect(softDeleted).toMatchObject({ data: true, error: null });

  const hide = await seller.db
    .from("creatures")
    .update({ page_visible: false }, { count: "exact" })
    .eq("id", creatureId);
  expect(hide.count).toBe(1);
});
