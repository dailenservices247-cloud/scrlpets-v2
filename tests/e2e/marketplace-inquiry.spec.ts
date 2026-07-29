import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";
import { MEMBER_EMAIL, MEMBER_PROFILE_ID, SELLER_EMAIL, signInCached } from "./fixtures";

const BUYER_EMAIL = MEMBER_EMAIL;
const BUYER_PROFILE_ID = MEMBER_PROFILE_ID;

function databaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function expectNoSeriousA11y(page: import("@playwright/test").Page) {
  await expect(page).toHaveTitle(/\S+/);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(serious).toEqual([]);
}

test("listing inquiry preserves evidence and stays inside its participants", async ({
  page,
}) => {
  const password = process.env.E2E_PASSWORD!;
  const stamp = Date.now();
  const brandName = `E2E Inquiry Brand ${stamp}`;
  const listingTitle = `E2E inquiry listing ${stamp}`;
  const editedTitle = `${listingTitle} edited later`;

  const { db: sellerDb, userId: __uid_sellerDb } = await signInCached(SELLER_EMAIL);
  const sellerAuth = { data: { user: { id: __uid_sellerDb } }, error: null };
  expect(sellerAuth.error).toBeNull();
  const sellerId = sellerAuth.data.user!.id;

  const { db: buyerDb, userId: __uid_buyerDb } = await signInCached(BUYER_EMAIL);
  const buyerAuth = { data: { user: { id: __uid_buyerDb } }, error: null };
  expect(buyerAuth.error).toBeNull();

  const { data: creature, error: creatureError } = await sellerDb
    .from("creatures")
    .select("id,name")
    .eq("owner_id", sellerId)
    .limit(1)
    .single();
  expect(creatureError).toBeNull();

  const { data: brand, error: brandError } = await sellerDb
    .from("brands")
    .insert({
      owner_id: sellerId,
      name: brandName,
      slug: `e2e-inquiry-${stamp}`,
      brand_type: "kennel",
    })
    .select("id")
    .single();
  expect(brandError).toBeNull();

  const ownerMembership = await sellerDb.from("brand_memberships").insert({
    brand_id: brand!.id,
    profile_id: sellerId,
    role: "owner",
  });
  expect(ownerMembership.error).toBeNull();

  // Phase 2 gate: an animal listing needs the animal attested by its owner.
  // (The E2E seller fixture is a seeded verified seller in dev data.)
  await sellerDb.rpc("attest_animal_eligibility", { target_creature: creature!.id });

  const { data: listing, error: listingError } = await sellerDb
    .from("listings")
    .insert({
      seller_id: sellerId,
      title: listingTitle,
      price_cents: 245000,
      creature_id: creature!.id,
      posting_as_type: "brand",
      brand_id: brand!.id,
    })
    .select("id")
    .single();
  expect(listingError).toBeNull();

  const selfInquiry = await sellerDb.rpc("start_listing_inquiry", {
    target_listing_id: listing!.id,
  });
  expect(selfInquiry.error?.message).toContain("self_inquiry");

  const directInsert = await buyerDb.from("listing_inquiries").insert({
    listing_id: listing!.id,
    conversation_id: crypto.randomUUID(),
    buyer_id: BUYER_PROFILE_ID,
    seller_id: sellerId,
    listing_title_snapshot: listingTitle,
    price_cents_snapshot: 245000,
    listing_created_at_snapshot: new Date().toISOString(),
  });
  expect(directInsert.error).not.toBeNull();

  const first = await buyerDb.rpc("start_listing_inquiry", {
    target_listing_id: listing!.id,
  });
  expect(first.error).toBeNull();
  expect(first.data).toHaveLength(1);
  expect(first.data![0].created).toBe(true);

  const duplicate = await buyerDb.rpc("start_listing_inquiry", {
    target_listing_id: listing!.id,
  });
  expect(duplicate.error).toBeNull();
  expect(duplicate.data![0]).toMatchObject({
    inquiry_id: first.data![0].inquiry_id,
    conversation_id: first.data![0].conversation_id,
    created: false,
  });

  const { data: buyerEvidence, error: buyerEvidenceError } = await buyerDb
    .from("listing_inquiries")
    .select(
      "id,buyer_id,seller_id,listing_title_snapshot,price_cents_snapshot,creature_name_snapshot,brand_name_snapshot",
    )
    .eq("id", first.data![0].inquiry_id)
    .single();
  expect(buyerEvidenceError).toBeNull();
  expect(buyerEvidence).toMatchObject({
    buyer_id: BUYER_PROFILE_ID,
    seller_id: sellerId,
    listing_title_snapshot: listingTitle,
    price_cents_snapshot: 245000,
    creature_name_snapshot: creature!.name,
    brand_name_snapshot: brandName,
  });

  const { data: sellerEvidence, error: sellerEvidenceError } = await sellerDb
    .from("listing_inquiries")
    .select("id")
    .eq("id", first.data![0].inquiry_id);
  expect(sellerEvidenceError).toBeNull();
  expect(sellerEvidence).toEqual([{ id: first.data![0].inquiry_id }]);

  const anonymousDb = databaseClient();
  const anonymousEvidence = await anonymousDb
    .from("listing_inquiries")
    .select("id")
    .eq("id", first.data![0].inquiry_id);
  expect(
    anonymousEvidence.error !== null || anonymousEvidence.data?.length === 0,
  ).toBe(true);

  const directUpdate = await buyerDb
    .from("listing_inquiries")
    .update({ listing_title_snapshot: "tampered" })
    .eq("id", first.data![0].inquiry_id);
  expect(directUpdate.error).not.toBeNull();
  const directDelete = await buyerDb
    .from("listing_inquiries")
    .delete()
    .eq("id", first.data![0].inquiry_id);
  expect(directDelete.error).not.toBeNull();

  await page.context().clearCookies();
  await page.goto(`/listing/${listing!.id}`);
  await expect(page.getByTestId("listing-price")).toHaveText("$2,450.00");
  await page.getByTestId("listing-inquiry-signin").click();
  await expect(page).toHaveURL(/\/login\?next=/, { timeout: 20_000 });
  await page.getByLabel("Email address").fill(BUYER_EMAIL);
  await page.getByLabel("Password").fill(password);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(`http://localhost:3000/listing/${listing!.id}`, {
    timeout: 20_000,
  });
  await page.getByTestId("start-listing-inquiry").click();
  await expect(page).toHaveURL(
    new RegExp(`/messages/${first.data![0].conversation_id}`),
    { timeout: 20_000 },
  );
  const context = page
    .getByTestId("message-context-pill")
    .filter({ hasText: listingTitle });
  await expect(context).toHaveCount(1);
  await expect(context).toContainText(listingTitle);
  await expect(context).toContainText("$2,450.00");
  await expect(context).toContainText(brandName);
  await expect(context).toContainText(creature!.name);
  await expectNoSeriousA11y(page);

  const listingEdit = await sellerDb
    .from("listings")
    .update({ title: editedTitle })
    .eq("id", listing!.id)
    .select("id");
  expect(listingEdit.data).toEqual([{ id: listing!.id }]);
  await page.reload();
  await expect(context).toContainText(listingTitle);
  await expect(context).not.toContainText(editedTitle);

  const softDelete = await sellerDb.rpc("soft_delete_managed_listing", {
    target_listing_id: listing!.id,
  });
  expect(softDelete).toMatchObject({ data: true, error: null });
  const unavailable = await buyerDb.rpc("start_listing_inquiry", {
    target_listing_id: listing!.id,
  });
  expect(unavailable.error?.message).toContain("listing_unavailable");
  await page.reload();
  await expect(context).toContainText(listingTitle);
  await expect(context).toContainText("unavailable");
  await expect(context).not.toHaveAttribute("href");
});
