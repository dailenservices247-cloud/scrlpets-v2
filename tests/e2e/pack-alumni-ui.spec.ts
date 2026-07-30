import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  MEMBER_EMAIL,
  MEMBER_USERNAME,
  SELLER_EMAIL,
  SELLER_USERNAME,
  THIRD_EMAIL,
  signInCached,
} from "./fixtures";

/**
 * PHASE D — the pack and alumni SURFACES (the spine itself is covered by
 * pack-alumni-spine.spec.ts, which proves the triggers and policies).
 *
 * Nothing here asserts on feed placement: applyDensityCaps allows one
 * commercial item per eight feed items, so a listing is never guaranteed a
 * slot. Every row is looked up by the id the test created and asserted on its
 * own page — the pattern content-edit-delete.spec.ts established.
 */

/**
 * The founder's standing rule: this app is for every animal sold as a pet, so
 * no dog-shaped vocabulary reaches a user-facing string. "pupdate" survives as
 * an internal word only. This guard is a ratchet — it passes on the surfaces as
 * shipped and fails the moment someone types one of these into the copy.
 */
const DOG_SHAPED_WORDS = /pup-?date|puppies|puppy|\bpups?\b|\blitters?\b/i;

async function signInBrowser(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
}

/** Both directions, because the pair index does not care who invited whom. */
async function severPair(
  db: Awaited<ReturnType<typeof signInCached>>["db"],
  a: string,
  b: string,
) {
  await db.from("pack_links").delete().eq("requester_id", a).eq("addressee_id", b);
  await db.from("pack_links").delete().eq("requester_id", b).eq("addressee_id", a);
}

/** A listable animal owned by the seller, plus its live listing. */
async function seedListedAnimal(
  seller: Awaited<ReturnType<typeof signInCached>>,
  stamp: number,
  label: string,
) {
  const creature = await seller.db
    .from("creatures")
    .insert({
      owner_id: seller.userId,
      name: `E2E ${label} animal ${stamp}`,
      slug: `e2e-${label}-${stamp}`,
      species: "Cat",
      birth_date: "2025-01-01",
      weaned_date: "2025-03-01",
    })
    .select("id,slug,name")
    .single();
  expect(creature.error).toBeNull();
  await seller.db.rpc("attest_animal_eligibility", { target_creature: creature.data!.id });

  const listing = await seller.db
    .from("listings")
    .insert({
      seller_id: seller.userId,
      title: `E2E ${label} listing ${stamp}`,
      price_cents: 10000,
      creature_id: creature.data!.id,
    })
    .select("id")
    .single();
  expect(listing.error).toBeNull();
  return { creature: creature.data!, listingId: listing.data!.id as string };
}

test("pack request is accepted from /pack, and removing a member severs the link for both", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const seller = await signInCached(SELLER_EMAIL);
  const third = await signInCached(THIRD_EMAIL);
  await severPair(third.db, seller.userId, third.userId);

  const invite = await third.db
    .from("pack_links")
    .insert({ requester_id: third.userId, addressee_id: seller.userId })
    .select("id,status")
    .single();
  expect(invite.error).toBeNull();
  expect(invite.data!.status, "the table only allows pending and accepted").toBe("pending");
  const linkId = invite.data!.id as string;

  await signInBrowser(page, SELLER_EMAIL);
  await page.goto("/pack");

  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serious, JSON.stringify(serious.map((v) => v.id))).toEqual([]);

  // The request is addressed to this viewer, so it is actionable here.
  await expect(page.getByTestId(`pack-accept-${linkId}`)).toBeVisible();
  await page.getByTestId(`pack-accept-${linkId}`).click();

  // Accepted: the request controls are gone and the member row carries the same id.
  await expect(page.getByTestId(`pack-accept-${linkId}`)).toHaveCount(0);
  await expect(page.getByTestId(`pack-remove-${linkId}`)).toBeVisible();
  const accepted = await third.db
    .from("pack_links")
    .select("status,accepted_at")
    .eq("id", linkId)
    .single();
  expect(accepted.data!.status).toBe("accepted");
  expect(accepted.data!.accepted_at).not.toBeNull();

  // Species-neutral vocabulary on the shipped surface.
  await expect(page.getByTestId("app-shell")).not.toContainText(DOG_SHAPED_WORDS);

  // Removal is confirmed, because it is not one-sided.
  await page.getByTestId(`pack-remove-${linkId}`).click();
  await expect(page.getByTestId("pack-remove-dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("pack-remove-dialog")).toBeHidden();

  await page.getByTestId(`pack-remove-${linkId}`).click();
  await page.getByTestId("pack-remove-confirm").click();
  await expect(page.getByTestId(`pack-remove-${linkId}`)).toHaveCount(0);

  // THE honesty assertion: the other party's row is gone too — "remove" is a
  // severed link, not a private mute.
  const afterRemoval = await third.db.from("pack_links").select("id").eq("id", linkId);
  expect(afterRemoval.data, "removal deletes the link for both people").toEqual([]);

  await third.db
    .from("notifications")
    .delete()
    .eq("kind", "pack_invite")
    .eq("target_id", linkId);
});

test("alumni timeline is two-sided and attributes every update to its real author", async ({
  page,
}) => {
  test.setTimeout(240_000);
  const seller = await signInCached(SELLER_EMAIL);
  const buyer = await signInCached(MEMBER_EMAIL);
  const stamp = Date.now();
  await severPair(seller.db, seller.userId, buyer.userId);

  const { creature, listingId } = await seedListedAnimal(seller, stamp, "alumni");

  const application = await buyer.db
    .from("buyer_applications")
    .insert({ buyer_id: buyer.userId, seller_id: seller.userId, listing_id: listingId })
    .select("id")
    .single();
  expect(application.error).toBeNull();
  const applicationId = application.data!.id as string;

  expect(
    (
      await seller.db.rpc("set_application_status", {
        target_application: applicationId,
        new_status: "accepted",
      })
    ).error,
  ).toBeNull();
  expect(
    (await buyer.db.rpc("confirm_handover", { target_application: applicationId })).error,
  ).toBeNull();
  expect(
    (await seller.db.rpc("confirm_handover", { target_application: applicationId })).error,
  ).toBeNull();

  const alumni = await buyer.db
    .from("alumni")
    .select("id")
    .eq("application_id", applicationId)
    .single();
  expect(alumni.error).toBeNull();
  const alumniId = alumni.data!.id as string;

  // ---- The NEW OWNER posts the first update. --------------------------------
  await signInBrowser(page, MEMBER_EMAIL);
  await page.goto("/pack/alumni");
  await expect(page.getByTestId(`alumni-open-${alumniId}`)).toBeVisible();
  await expect(page.getByTestId("app-shell")).not.toContainText(DOG_SHAPED_WORDS);
  await page.getByTestId(`alumni-open-${alumniId}`).click();
  await expect(page).toHaveURL(new RegExp(`/pack/alumni/${alumniId}$`), { timeout: 20_000 });
  // The animal is a Cat, so the breeder side reads "Cattery" — proof the
  // vocabulary comes from lib/species/identity and not from a dog-shaped
  // literal. A Dog would read "Kennel"; an unknown species, "Breeder".
  await expect(page.getByTestId("alumni-role-badge")).toHaveText("Cattery");

  const ownerUpdate = `E2E owner update ${stamp}`;
  await page.getByTestId("alumni-update-body").fill(ownerUpdate);
  await page.getByTestId("alumni-update-submit").click();
  const ownerEntry = page.getByTestId("alumni-update").filter({ hasText: ownerUpdate });
  await expect(ownerEntry).toBeVisible({ timeout: 20_000 });
  // Identity is asserted on the profile href, not a display string: this is the
  // exact thing legacy got wrong, so the assertion has to name the person.
  await expect(ownerEntry.getByTestId("alumni-update-author")).toHaveAttribute(
    "href",
    `/u/${MEMBER_USERNAME}`,
  );
  await expect(page.getByTestId("app-shell")).not.toContainText(DOG_SHAPED_WORDS);

  // ---- The BREEDER sees the same entry, still attributed to the owner. ------
  await signInBrowser(page, SELLER_EMAIL);
  await page.goto(`/pack/alumni/${alumniId}`);
  const sameEntry = page.getByTestId("alumni-update").filter({ hasText: ownerUpdate });
  await expect(sameEntry).toBeVisible({ timeout: 20_000 });
  await expect(
    sameEntry.getByTestId("alumni-update-author"),
    "the breeder must not see their own name on the owner's update",
  ).toHaveAttribute("href", `/u/${MEMBER_USERNAME}`);

  const breederUpdate = `E2E breeder update ${stamp}`;
  await page.getByTestId("alumni-update-body").fill(breederUpdate);
  await page.getByTestId("alumni-update-submit").click();
  const breederEntry = page.getByTestId("alumni-update").filter({ hasText: breederUpdate });
  await expect(breederEntry).toBeVisible({ timeout: 20_000 });
  await expect(breederEntry.getByTestId("alumni-update-author")).toHaveAttribute(
    "href",
    `/u/${SELLER_USERNAME}`,
  );

  // ---- Back on the owner's side: both entries, each with its own author. ----
  await signInBrowser(page, MEMBER_EMAIL);
  await page.goto(`/pack/alumni/${alumniId}`);
  await expect(page.getByTestId("alumni-update")).toHaveCount(2, { timeout: 20_000 });
  await expect(
    page
      .getByTestId("alumni-update")
      .filter({ hasText: breederUpdate })
      .getByTestId("alumni-update-author"),
  ).toHaveAttribute("href", `/u/${SELLER_USERNAME}`);

  // ---- Mute is one-sided, and reversible. ----------------------------------
  await page.goto("/pack/alumni");
  await page.getByTestId(`alumni-mute-${alumniId}`).click();
  await expect(page.getByTestId("alumni-list").getByTestId(`alumni-open-${alumniId}`)).toHaveCount(0);
  await expect(page.getByTestId("alumni-muted").getByTestId(`alumni-open-${alumniId}`)).toHaveCount(1);
  const muteFlags = await buyer.db
    .from("alumni")
    .select("muted_by_owner,muted_by_breeder")
    .eq("id", alumniId)
    .single();
  expect(muteFlags.data, "muting your side never touches theirs").toEqual({
    muted_by_owner: true,
    muted_by_breeder: false,
  });

  await page.getByTestId("alumni-muted").locator("summary").click();
  await page.getByTestId(`alumni-mute-${alumniId}`).click();
  await expect(page.getByTestId("alumni-list").getByTestId(`alumni-open-${alumniId}`)).toHaveCount(1);

  // Cleanup that is possible: the confirmed application and its alumni row are
  // permanent evidence (see pack-alumni-spine.spec.ts), so only the pack pair,
  // the listing and the animal's visibility come back.
  await severPair(seller.db, seller.userId, buyer.userId);
  await seller.db.rpc("soft_delete_managed_listing", { target_listing_id: listingId });
  await seller.db.from("creatures").update({ page_visible: false }).eq("id", creature.id);
});

test("a signed-in non-owner gets message-owner and a live-listing banner on an animal page", async ({
  page,
}) => {
  test.setTimeout(150_000);
  const seller = await signInCached(SELLER_EMAIL);
  const stamp = Date.now();
  const { creature, listingId } = await seedListedAnimal(seller, stamp, "visitor");

  await signInBrowser(page, MEMBER_EMAIL);
  await page.goto(`/c/${creature.slug}`);
  await expect(page.getByTestId("creature-visitor-actions")).toBeVisible();
  // The banner is honest about pointing at a live listing, and points at THIS one.
  await expect(page.getByTestId("creature-visitor-listing-banner")).toHaveAttribute(
    "href",
    `/listing/${listingId}`,
  );
  // The animal page renders its own <main>, not the AppPage shell.
  await expect(page.locator("main").first()).not.toContainText(DOG_SHAPED_WORDS);

  // Message owner rides the existing conversation-start path — no new logic,
  // so the proof is that it lands on a real conversation.
  await page.getByTestId("message-button").click();
  await expect(page).toHaveURL(/\/messages\/[0-9a-f-]{36}$/, { timeout: 20_000 });

  // The owner is not a visitor to their own animal.
  await signInBrowser(page, SELLER_EMAIL);
  await page.goto(`/c/${creature.slug}`);
  await expect(page.getByTestId("creature-header")).toBeVisible();
  await expect(page.getByTestId("creature-visitor-actions")).toHaveCount(0);

  await seller.db.rpc("soft_delete_managed_listing", { target_listing_id: listingId });
  await seller.db.from("creatures").update({ page_visible: false }).eq("id", creature.id);
});
