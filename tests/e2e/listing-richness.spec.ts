import { expect, test } from "@playwright/test";
import { SELLER_EMAIL, signInCached } from "./fixtures";

const DAY_MS = 24 * 60 * 60 * 1000;
function daysAgoISODate(n: number): string {
  return new Date(Date.now() - n * DAY_MS).toISOString().slice(0, 10);
}

test("listing page renders the photo gallery, structured pet details, and real verification state", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const { db, userId } = await signInCached(SELLER_EMAIL);

  // Fresh creature with every field the structured pet-details panel renders.
  // Species is deliberately non-dog/cat so the 9 CFR 2.130 age gate (V2-06)
  // never enters into this test; the birth date still lands cleanly in the
  // "weeks old" bucket (12 weeks) to match V2-01's own worked example.
  const creature = await db
    .from("creatures")
    .insert({
      owner_id: userId,
      name: `E2E Richness Pet ${stamp}`,
      slug: `e2e-richness-${stamp}`,
      species: "Rabbit",
      breed: "Holland Lop",
      gender: "female",
      color: "White",
      markings: "Black-tipped ears",
      registration_number: `REG-${stamp}`,
      birth_date: daysAgoISODate(84),
      weaned_date: daysAgoISODate(56),
    })
    .select("id")
    .single();
  expect(creature.error).toBeNull();
  const creatureId = creature.data!.id;

  // Phase 2 gate: an animal listing requires the animal attested by its owner
  // AND a verified seller. SELLER_EMAIL is a seeded identity-verified seller
  // in dev data (tests/e2e/fixtures.ts) — if it weren't, the listing insert
  // below would fail outright, not just the verification-badge assertion.
  const attest = await db.rpc("attest_animal_eligibility", { target_creature: creatureId });
  expect(attest.error).toBeNull();

  const title = `E2E richness listing ${stamp}`;
  const listing = await db
    .from("listings")
    .insert({
      seller_id: userId,
      title,
      price_cents: 45000,
      creature_id: creatureId,
      description: "E2E richness description",
    })
    .select("id")
    .single();
  expect(listing.error).toBeNull();
  const listingId = listing.data!.id;

  const photos = await db
    .from("listing_photos")
    .insert([
      {
        listing_id: listingId,
        photo_url: "https://picsum.photos/seed/e2e-rich-1/640/480",
        caption: "First gallery photo",
        display_order: 0,
      },
      {
        listing_id: listingId,
        photo_url: "https://picsum.photos/seed/e2e-rich-2/640/480",
        caption: "Second gallery photo",
        display_order: 1,
      },
    ])
    .select("id");
  expect(photos.error).toBeNull();
  expect(photos.data).toHaveLength(2);

  // UI sign-in (per compose.spec.ts's beforeEach), then straight to the
  // listing by id — never assert feed placement, the feed caps commercial
  // density and this listing may not land there at all.
  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });

  await page.goto(`/listing/${listingId}`);

  // Gallery renders both photos and opens the fullscreen viewer.
  await expect(page.getByTestId("listing-gallery")).toBeVisible();
  await expect(page.getByTestId("listing-gallery-photo-0")).toBeVisible();
  await expect(page.getByTestId("listing-gallery-photo-1")).toBeVisible();

  await page.getByTestId("listing-gallery-photo-0").click();
  await expect(page.getByTestId("gallery-viewer")).toBeVisible();
  await expect(page.getByTestId("gallery-viewer-counter")).toHaveText("1 / 2");
  await expect(page.getByTestId("gallery-viewer-caption")).toHaveText("First gallery photo");

  await page.getByTestId("gallery-viewer-next").click();
  await expect(page.getByTestId("gallery-viewer-counter")).toHaveText("2 / 2");
  await expect(page.getByTestId("gallery-viewer-caption")).toHaveText("Second gallery photo");

  await page.keyboard.press("Escape");
  await expect(page.getByTestId("gallery-viewer")).toBeHidden();

  // Structured pet details: values shown, dates present, age line computed.
  await expect(page.getByTestId("pet-details-panel")).toBeVisible();
  await expect(page.getByTestId("pet-detail-breed")).toContainText("Holland Lop");
  await expect(page.getByTestId("pet-detail-gender")).toContainText("Female");
  await expect(page.getByTestId("pet-detail-color")).toContainText("White");
  await expect(page.getByTestId("pet-detail-markings")).toContainText("Black-tipped ears");
  await expect(page.getByTestId("pet-detail-registration")).toContainText(`REG-${stamp}`);
  await expect(page.getByTestId("pet-detail-born")).toBeVisible();
  await expect(page.getByTestId("pet-detail-weaned")).toBeVisible();
  await expect(page.getByTestId("pet-detail-age")).toContainText("12 weeks old");

  // Real verification state — never an absence, never a hardcoded claim.
  await expect(page.getByTestId("listing-seller-verified")).toBeVisible();
  await expect(page.getByTestId("listing-animal-attested")).toBeVisible();
  await expect(page.getByTestId("listing-not-inspected-notice")).toBeVisible();

  // Cleanup. Soft-delete hides the listing (and, via the photos' own RLS
  // deferring to the listing, its gallery); the creature is hidden rather
  // than hard-deleted — no creature hard-delete path exists once listed.
  const softDelete = await db.rpc("soft_delete_managed_listing", { target_listing_id: listingId });
  expect(softDelete).toMatchObject({ data: true, error: null });

  const remainingPhotos = await db.from("listing_photos").select("id").eq("listing_id", listingId);
  expect(remainingPhotos.data).toHaveLength(0);

  const hideCreature = await db
    .from("creatures")
    .update({ page_visible: false })
    .eq("id", creatureId)
    .select("id");
  expect(hideCreature.data).toEqual([{ id: creatureId }]);
});
