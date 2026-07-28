import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BUYER_EMAIL = "scrlpets-rbac-e2e@scrlpets.com";

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
 * THE REVIEW GATE. Legacy carried a `verified_purchase` boolean — a flag that
 * had to be set correctly, and therefore could be wrong. Here a review cannot
 * exist without a handover BOTH parties confirmed. This test is what keeps
 * that structural.
 */
test("a review requires a handover both parties confirmed", async () => {
  test.setTimeout(120_000);
  const seller = await signIn(process.env.E2E_EMAIL!);
  const buyer = await signIn(BUYER_EMAIL);
  const stamp = Date.now();

  const listing = await seller.db
    .from("listings")
    .insert({ seller_id: seller.userId, title: `E2E review listing ${stamp}`, price_cents: 5000 })
    .select("id")
    .single();
  const listingId = listing.data!.id;

  const application = await buyer.db
    .from("buyer_applications")
    .insert({ buyer_id: buyer.userId, seller_id: seller.userId, listing_id: listingId })
    .select("id")
    .single();
  expect(application.error).toBeNull();
  const applicationId = application.data!.id;

  const review = () =>
    buyer.db.from("reviews").insert({
      application_id: applicationId,
      reviewer_id: buyer.userId,
      subject_id: seller.userId,
      rating: 5,
    });

  // 1. Submitted but not accepted → no review.
  expect((await review()).error).not.toBeNull();

  // Confirming before acceptance is refused outright.
  const early = await buyer.db.rpc("confirm_handover", { target_application: applicationId });
  expect(early.error?.message).toContain("application_not_accepted");

  // 2. Accepted, nobody confirmed → still no review.
  await seller.db.rpc("set_application_status", {
    target_application: applicationId,
    new_status: "accepted",
  });
  expect((await review()).error).not.toBeNull();

  // 3. Only the buyer confirmed → still no review. One side is not a handover.
  await buyer.db.rpc("confirm_handover", { target_application: applicationId });
  expect((await review()).error).not.toBeNull();

  // 4. Both confirmed → the review lands.
  await seller.db.rpc("confirm_handover", { target_application: applicationId });
  const accepted = await review();
  expect(accepted.error).toBeNull();

  // 5. One review per handover, not per pair of people.
  expect((await review()).error).not.toBeNull();

  // 6. The seller cannot delete criticism, and cannot rewrite it.
  const sellerDelete = await seller.db
    .from("reviews")
    .delete({ count: "exact" })
    .eq("application_id", applicationId);
  expect(sellerDelete.count ?? 0).toBe(0);
  const sellerEdit = await seller.db
    .from("reviews")
    .update({ rating: 1 }, { count: "exact" })
    .eq("application_id", applicationId);
  expect(sellerEdit.count ?? 0).toBe(0);

  // 7. The author may correct their own words, but not who it is about.
  const rehome = await buyer.db
    .from("reviews")
    .update({ subject_id: buyer.userId, rating: 4 })
    .eq("application_id", applicationId)
    .select("subject_id,rating")
    .single();
  expect(rehome.data!.subject_id, "subject is fixed at creation").toBe(seller.userId);
  expect(rehome.data!.rating).toBe(4);

  await seller.db.from("buyer_applications").delete().eq("id", applicationId);
  await seller.db.from("listings").delete().eq("id", listingId);
});

/** Nobody can confirm a handover on the other party's behalf. */
test("handover confirmation cannot be forged by an outsider", async () => {
  test.setTimeout(120_000);
  const seller = await signIn(process.env.E2E_EMAIL!);
  const buyer = await signIn(BUYER_EMAIL);
  const stamp = Date.now();

  const listing = await seller.db
    .from("listings")
    .insert({ seller_id: seller.userId, title: `E2E forge listing ${stamp}`, price_cents: 5000 })
    .select("id")
    .single();
  const application = await buyer.db
    .from("buyer_applications")
    .insert({ buyer_id: buyer.userId, seller_id: seller.userId, listing_id: listing.data!.id })
    .select("id")
    .single();
  const applicationId = application.data!.id;
  await seller.db.rpc("set_application_status", {
    target_application: applicationId,
    new_status: "accepted",
  });

  const outsider = databaseClient();
  await outsider.auth.signInWithPassword({
    email: "scrlpets-rbac-third@scrlpets.com",
    password: process.env.E2E_PASSWORD!,
  });
  const forged = await outsider.rpc("confirm_handover", { target_application: applicationId });
  expect(forged.error?.message).toContain("not_a_party");

  // Direct column writes are refused too — there is no client UPDATE path.
  const direct = await buyer.db
    .from("buyer_applications")
    .update({ seller_confirmed_at: new Date().toISOString() }, { count: "exact" })
    .eq("id", applicationId);
  expect(direct.count ?? 0).toBe(0);

  await seller.db.from("buyer_applications").delete().eq("id", applicationId);
  await seller.db.from("listings").delete().eq("id", listing.data!.id);
});

/** Reviews render publicly, and the empty state is honest. */
test("profile shows reviews or an honest empty state", async ({ page }) => {
  await page.goto("/u/breeder_jane");
  await expect(page.getByTestId("reviews")).toBeVisible({ timeout: 20_000 });
  const shown =
    (await page.getByTestId("reviews-average").count()) +
    (await page.getByTestId("reviews-empty").count());
  expect(shown).toBeGreaterThan(0);
});
