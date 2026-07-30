import { expect, test } from "@playwright/test";
import { SELLER_EMAIL, MEMBER_EMAIL, signInCached } from "./fixtures";

async function loginViaUi(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
}

test.describe("creature archive", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await loginViaUi(page, SELLER_EMAIL);
  });

  test("archive hides the owner's tree card and 404s the public page; unarchive restores the owner view but not the public page", async ({
    page,
    browser,
  }) => {
    const seller = await signInCached(SELLER_EMAIL);
    const stamp = Date.now();
    const slug = `e2e-archive-${stamp}`;

    const created = await seller.db
      .from("creatures")
      .insert({
        owner_id: seller.userId,
        name: `E2E Archive Test ${stamp}`,
        slug,
        species: "Dog",
        page_visible: true,
      })
      .select("id")
      .single();
    expect(created.error).toBeNull();
    const creatureId = created.data!.id;

    await page.goto(`/c/${slug}`);
    await expect(page.getByTestId("archive-open")).toBeVisible();

    // Archive via UI.
    await page.getByTestId("archive-open").click();
    await expect(page.getByTestId("archive-dialog")).toBeVisible();
    await page.getByTestId("archive-confirm").click();
    await expect(page.getByTestId("creature-archived-badge")).toBeVisible();
    await expect(page.getByTestId("unarchive-open")).toBeVisible();

    const archived = await seller.db
      .from("creatures")
      .select("archived_at,page_visible")
      .eq("id", creatureId)
      .single();
    expect(archived.data?.archived_at).not.toBeNull();
    expect(archived.data?.page_visible).toBe(false);

    // KNOWN GAP (reported, not fixed here — out of this lane's granted
    // paths): src/lib/tree/queries.ts's fetchTree()/getOwnTree() — the
    // owner's own tree console — does not filter archived_at, so this
    // assertion documents the correct target behavior and will only go
    // green once the main thread adds that filter.
    await page.goto("/tree");
    await expect(page.getByTestId("tree-header")).toBeVisible();
    await expect(page.getByTestId(`tree-card-link-${creatureId}`)).toHaveCount(0);

    // Guest: the public page 404s while archived.
    const guestContext = await browser.newContext();
    const guestPage = await guestContext.newPage();
    const guestRes = await guestPage.goto(`/c/${slug}`);
    expect(guestRes!.status()).toBe(404);
    await guestContext.close();

    // Unarchive via UI.
    await page.goto(`/c/${slug}`);
    await page.getByTestId("unarchive-open").click();
    await expect(page.getByTestId("unarchive-dialog")).toBeVisible();
    await page.getByTestId("unarchive-confirm").click();
    await expect(page.getByTestId("archive-open")).toBeVisible();
    await expect(page.getByTestId("creature-archived-badge")).toHaveCount(0);

    const unarchived = await seller.db
      .from("creatures")
      .select("archived_at,page_visible")
      .eq("id", creatureId)
      .single();
    expect(unarchived.data?.archived_at).toBeNull();
    // Unarchiving does NOT republish the public page — that stays a
    // separate, deliberate owner choice (the About sheet's visibility
    // checkbox), so the guest 404 must still hold.
    expect(unarchived.data?.page_visible).toBe(false);

    const guestContext2 = await browser.newContext();
    const guestPage2 = await guestContext2.newPage();
    const guestRes2 = await guestPage2.goto(`/c/${slug}`);
    expect(guestRes2!.status()).toBe(404);
    await guestContext2.close();

    // Cleanup — asserted: unreferenced, so the hard-delete RPC removes it.
    const cleanup = await seller.db.rpc("delete_creature_if_unreferenced", {
      target_creature: creatureId,
    });
    expect(cleanup.error).toBeNull();
    const gone = await seller.db.from("creatures").select("id").eq("id", creatureId).maybeSingle();
    expect(gone.data).toBeNull();
  });

  test("delete permanently succeeds on a brand-new unreferenced creature", async ({ page }) => {
    const seller = await signInCached(SELLER_EMAIL);
    const stamp = Date.now();
    const slug = `e2e-delete-clean-${stamp}`;

    const created = await seller.db
      .from("creatures")
      .insert({ owner_id: seller.userId, name: `E2E Delete Clean ${stamp}`, slug, species: "Cat" })
      .select("id")
      .single();
    expect(created.error).toBeNull();
    const creatureId = created.data!.id;

    await page.goto(`/c/${slug}`);
    await page.getByTestId("delete-permanently-open").click();
    await expect(page.getByTestId("delete-permanently-dialog")).toBeVisible();
    await page.getByTestId("delete-permanently-confirm").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });

    const gone = await seller.db.from("creatures").select("id").eq("id", creatureId).maybeSingle();
    expect(gone.data).toBeNull();
  });

  test("delete permanently refuses a creature referenced by a listing, with the honest message", async ({
    page,
  }) => {
    const seller = await signInCached(SELLER_EMAIL);
    const stamp = Date.now();
    const slug = `e2e-delete-refused-${stamp}`;

    const created = await seller.db
      .from("creatures")
      .insert({ owner_id: seller.userId, name: `E2E Delete Refused ${stamp}`, slug, species: "Dog" })
      .select("id")
      .single();
    expect(created.error).toBeNull();
    const creatureId = created.data!.id;

    // P0 gate: an animal listing needs a verified seller (SELLER_EMAIL is)
    // and that specific animal attested.
    const attest = await seller.db.rpc("attest_animal_eligibility", { target_creature: creatureId });
    expect(attest.error).toBeNull();

    const listing = await seller.db
      .from("listings")
      .insert({
        seller_id: seller.userId,
        title: `E2E delete-refused listing ${stamp}`,
        price_cents: 10000,
        creature_id: creatureId,
      })
      .select("id")
      .single();
    expect(listing.error).toBeNull();
    const listingId = listing.data!.id;

    await page.goto(`/c/${slug}`);
    await page.getByTestId("delete-permanently-open").click();
    await expect(page.getByTestId("delete-permanently-dialog")).toBeVisible();
    await page.getByTestId("delete-permanently-confirm").click();
    await expect(page.getByTestId("delete-referenced-error")).toBeVisible();

    const stillThere = await seller.db.from("creatures").select("id").eq("id", creatureId).maybeSingle();
    expect(stillThere.data).not.toBeNull();

    // THE INVARIANT, not a teardown convenience: listings soft-delete (there is
    // no client hard-delete path), and a soft-deleted listing is still a record
    // referencing this animal. So once an animal has been listed it stays
    // permanently un-hard-deletable — archiving is the only removal, which is
    // exactly what "history stays intact" has to mean.
    const softDeleted = await seller.db.rpc("soft_delete_managed_listing", {
      target_listing_id: listingId,
    });
    expect(softDeleted.error).toBeNull();
    const stillRefused = await seller.db.rpc("delete_creature_if_unreferenced", {
      target_creature: creatureId,
    });
    expect(stillRefused.error?.message ?? "").toContain("creature_referenced");

    // Archive is the available control — assert it works on this animal.
    const archived = await seller.db.rpc("archive_creature", {
      target_creature: creatureId,
      archived: true,
    });
    expect(archived.error).toBeNull();
  });
});

test.describe("application withdrawal", () => {
  test.describe.configure({ timeout: 120_000 });

  test.beforeEach(async ({ page }) => {
    await loginViaUi(page, MEMBER_EMAIL);
  });

  test("buyer withdraws via UI; a second application refuses once a confirmation is set", async ({ page }) => {
    const seller = await signInCached(SELLER_EMAIL);
    const buyer = await signInCached(MEMBER_EMAIL);
    const stamp = Date.now();

    // Idempotency: `idx_one_open_waitlist` allows exactly one SUBMITTED
    // listing-less application per buyer/seller pair, so a leftover from a run
    // that died mid-test would block every future run. Clear ours first.
    const stale = await buyer.db
      .from("buyer_applications")
      .select("id")
      .eq("buyer_id", buyer.userId)
      .eq("seller_id", seller.userId)
      .is("listing_id", null)
      .eq("status", "submitted");
    for (const row of stale.data ?? []) {
      await buyer.db.rpc("set_application_status", {
        target_application: row.id,
        new_status: "withdrawn",
      });
    }

    // --- App 1: submitted -> withdrawn via UI. ---
    const app1 = await buyer.db
      .from("buyer_applications")
      .insert({
        buyer_id: buyer.userId,
        seller_id: seller.userId,
        listing_id: null,
        message: `E2E withdraw ${stamp}`,
      })
      .select("id")
      .single();
    expect(app1.error).toBeNull();
    const app1Id = app1.data!.id;

    await page.goto("/applications");
    await expect(page.getByTestId(`withdraw-open-${app1Id}`)).toBeVisible();
    await page.getByTestId(`withdraw-open-${app1Id}`).click();
    await expect(page.getByTestId(`withdraw-dialog-${app1Id}`)).toBeVisible();
    await page.getByTestId(`withdraw-confirm-${app1Id}`).click();
    await expect(page.getByTestId(`withdraw-open-${app1Id}`)).toHaveCount(0);

    const app1Status = await buyer.db.from("buyer_applications").select("status").eq("id", app1Id).single();
    expect(app1Status.data?.status).toBe("withdrawn");

    // --- App 2: accepted, then a same-tab race — the buyer confirms
    // handover while the withdraw dialog is already open, so the confirm
    // click lands after the DB truth has moved on. This is the realistic
    // way handover_started ever surfaces through the UI: the "withdrawable"
    // list itself hides the button the instant a confirmation lands, so a
    // user can only ever hit the server-side refusal via this kind of race. ---
    const app2 = await buyer.db
      .from("buyer_applications")
      .insert({
        buyer_id: buyer.userId,
        seller_id: seller.userId,
        listing_id: null,
        message: `E2E withdraw race ${stamp}`,
      })
      .select("id")
      .single();
    expect(app2.error).toBeNull();
    const app2Id = app2.data!.id;

    const accept = await seller.db.rpc("set_application_status", {
      target_application: app2Id,
      new_status: "accepted",
    });
    expect(accept.error).toBeNull();

    await page.goto("/applications");
    await expect(page.getByTestId(`withdraw-open-${app2Id}`)).toBeVisible();
    await page.getByTestId(`withdraw-open-${app2Id}`).click();
    await expect(page.getByTestId(`withdraw-dialog-${app2Id}`)).toBeVisible();

    const confirmHandover = await buyer.db.rpc("confirm_handover", { target_application: app2Id });
    expect(confirmHandover.error).toBeNull();

    await page.getByTestId(`withdraw-confirm-${app2Id}`).click();
    await expect(page.getByTestId(`withdraw-error-${app2Id}`)).toBeVisible();

    const app2Status = await buyer.db
      .from("buyer_applications")
      .select("status,buyer_confirmed_at")
      .eq("id", app2Id)
      .single();
    expect(app2Status.data?.status).toBe("accepted");
    expect(app2Status.data?.buyer_confirmed_at).not.toBeNull();

    // Cleanup, asserted: buyer_applications has no client DELETE policy at
    // all (only "read own applications" and "buyer submits application"
    // exist — see 20260727192855_commerce_entities_applications.sql), so
    // both deletes are expected zero-row no-ops, same invariant
    // pack-alumni-spine.spec.ts asserts for a confirmed application.
    const delApp1 = await buyer.db.from("buyer_applications").delete({ count: "exact" }).eq("id", app1Id);
    expect(delApp1.count).toBe(0);
    const delApp2 = await buyer.db.from("buyer_applications").delete({ count: "exact" }).eq("id", app2Id);
    expect(delApp2.count).toBe(0);
  });
});
