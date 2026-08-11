import { test, expect } from "@playwright/test";
import { SELLER_EMAIL, signInCached } from "./fixtures";

test("signed-out /compose redirects to login", async ({ page }) => {
  await page.goto("/compose");
  await expect(page).toHaveURL(/\/login/);
});

test.describe("signed in", () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(SELLER_EMAIL);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
  });

  test("create text post → appears at top of feed", async ({ page }) => {
    const marker = `E2E post ${Date.now()}`;
    await page.getByTestId("compose-cta").click();
    await page.getByTestId("post-body").fill(marker);
    await page.getByTestId("post-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
    await expect(page.getByText(marker)).toBeVisible();
  });

  test("composer alignment exposes identity, mode, subject, and preview", async ({ page }) => {
    await page.goto("/compose?mode=listing");
    await expect(page.getByTestId("composer-alignment")).toBeVisible();
    // Options are collapsed by default (A9 quick-post); expand them first.
    await page.getByTestId("composer-more-options").click();
    await expect(page.getByTestId("posting-as-selector")).toBeVisible();
    await expect(page.getByTestId("mode-selector")).toBeVisible();
    await expect(page.getByTestId("about-selector")).toBeVisible();
    await expect(page.getByTestId("attribution-preview")).toBeVisible();
    await expect(page.getByTestId("listing-form")).toBeVisible();
    await page.getByTestId("mode-selector").getByRole("button", { name: /Product/ }).click();
    await expect(page.getByTestId("planned-mode-panel")).toBeVisible();
  });

  // Deliberately does NOT assert feed placement: applyDensityCaps suppresses
  // commercial items to at most one per 8-item window, so whether a brand new
  // listing lands in the first screen of the feed is not something the product
  // guarantees — and under parallel workers another listing routinely takes
  // the slot. Assert the listing was really created, on its own page.
  test("create listing with price → listing exists with that price", async ({ page }) => {
    const marker = `E2E listing ${Date.now()}`;
    await page.goto("/compose");
    await page.getByRole("button", { name: /Listing/ }).click();
    await page.getByTestId("listing-title").fill(marker);
    await page.getByTestId("listing-price").fill("123.45");
    await page.getByTestId("listing-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });

    const { db: lookupDb } = await signInCached(SELLER_EMAIL);
    const { data: created } = await lookupDb
      .from("listings")
      .select("id,price_cents")
      .eq("title", marker)
      .single();
    expect(created!.price_cents).toBe(12345);
    await page.goto(`/listing/${created!.id}`);
    await expect(page.getByText(marker).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("$123.45").first()).toBeVisible({ timeout: 20_000 });
  });

  /**
   * The two terms that decide whether the escrow can do its job. They render
   * only for an ANIMAL sale, because neither means anything on a product — so
   * the listing specs above, which never attach an animal, cannot see them.
   *
   * Scope note: this asserts the CONTROLS, not a completed animal sale.
   * Publishing an animal listing additionally requires an attested animal (see
   * trust-core.spec.ts, which sets that up deliberately), and duplicating that
   * setup here would test the attestation gate a third time rather than these
   * fields. Persistence and the ceilings are covered by
   * supabase/probes/deposit_and_window.probe.sql and tests/unit/sale-terms.test.ts.
   */
  test("animal sale exposes deposit and inspection-window controls, bounded", async ({ page }) => {
    await page.goto("/compose");
    await page.getByRole("button", { name: /Listing/ }).click();
    await page.getByTestId("listing-title").fill(`E2E terms ${Date.now()}`);
    await page.getByTestId("listing-price").fill("2000.00");

    // No animal attached: neither term is on screen at all.
    await expect(page.getByTestId("sale-terms")).toHaveCount(0);

    await page.getByTestId("creature-picker").selectOption({ index: 1 });
    await expect(page.getByTestId("sale-terms")).toBeVisible();

    // The ceilings are enforced by the browser before a round trip, and again by
    // a CHECK constraint in the database. These attributes are the first of the
    // two — a seller typing 40 is stopped where they are standing.
    const deposit = page.getByTestId("listing-deposit");
    await expect(deposit).toHaveAttribute("max", "25");
    await expect(deposit).toHaveAttribute("min", "0");

    const window_ = page.getByTestId("listing-inspection-hours");
    await expect(window_).toHaveAttribute("min", "24");
    await expect(window_).toHaveAttribute("max", "336");

    // Both are optional: a seller who sets nothing gets no deposit and the 24h
    // floor, which is what create_order writes.
    await expect(deposit).toHaveValue("");
    await expect(window_).toHaveValue("");
  });

  /**
   * Ruling 3's dependency: a seller must be able to pick a standard guarantee
   * instead of free-typing, and must see exactly what a buyer will read. The
   * preview is rendered by the same database function the listing page uses, so
   * this asserts the words themselves, not that "a preview appeared".
   */
  test("guarantee: forced choice, standard templates, and a buyer's-eye preview", async ({
    page,
  }) => {
    await page.goto("/compose");
    await page.getByRole("button", { name: /Listing/ }).click();
    await page.getByTestId("listing-title").fill(`E2E guarantee ${Date.now()}`);
    await page.getByTestId("listing-price").fill("1500.00");

    // Not offered on a product listing — a guarantee on a bag of feed is noise.
    await expect(page.getByTestId("guarantee-picker")).toHaveCount(0);
    await page.getByTestId("creature-picker").selectOption({ index: 1 });
    await expect(page.getByTestId("guarantee-picker")).toBeVisible();

    // Default is the explicit "none", and it SAYS so rather than showing nothing.
    await expect(page.getByTestId("guarantee-kind-none")).toBeChecked();
    await expect(page.getByTestId("guarantee-preview-headline")).toHaveText("No health guarantee", {
      timeout: 10_000,
    });

    // A standard guarantee names its remedy in the buyer's words.
    await page.getByTestId("guarantee-kind-template").check();
    await page
      .getByTestId("guarantee-template-select")
      .selectOption("congenital_1y_refund");
    await expect(page.getByTestId("guarantee-preview-remedy")).toContainText(
      /returned to the seller/i,
      { timeout: 10_000 },
    );

    // A vet-costs guarantee tells the buyer they KEEP the animal — the
    // distinction the whole §4 remedy split rests on.
    await page.getByTestId("guarantee-template-select").selectOption("health_14d_vet");
    await expect(page.getByTestId("guarantee-preview-remedy")).toContainText(/keep the animal/i, {
      timeout: 10_000,
    });

    // Free-typing is allowed, and warned about before it is written — not after
    // a dispute resolves against them.
    await page.getByTestId("guarantee-kind-custom").check();
    await expect(page.getByTestId("guarantee-custom-warning")).toContainText(
      /buyer's favour|buyer’s favour/i,
    );
  });

  /**
   * The other half of ruling 3: the words the seller previewed are the words the
   * buyer actually reads on the listing.
   *
   * Asserted against the database renderer rather than a hardcoded string, so
   * this fails if the panel ever starts composing its own prose — which is the
   * drift that would make holding a seller to their terms unfair.
   */
  test("the listing shows the seller's guarantee, worded by the shared renderer", async ({
    page,
  }) => {
    const { db, userId } = await signInCached(SELLER_EMAIL);
    const stamp = Date.now();

    const creature = await db
      .from("creatures")
      .insert({ owner_id: userId, name: `E2E gpanel ${stamp}`, slug: `e2e-gpanel-${stamp}` })
      .select("id")
      .single();
    expect(creature.error).toBeNull();
    const creatureId = creature.data!.id;
    await db.rpc("attest_animal_eligibility", { target_creature: creatureId });

    const listing = await db
      .from("listings")
      .insert({
        seller_id: userId,
        title: `E2E gpanel listing ${stamp}`,
        price_cents: 150000,
        creature_id: creatureId,
      })
      .select("id")
      .single();
    expect(listing.error).toBeNull();
    const listingId = listing.data!.id;

    // No guarantee published yet: the listing must SAY so, not stay silent.
    await page.goto(`/listing/${listingId}`);
    await expect(page.getByTestId("listing-guarantee-headline")).toHaveText(
      "No health guarantee",
      { timeout: 20_000 },
    );

    await db.from("listing_guarantees").insert({
      listing_id: listingId,
      kind: "template",
      template_key: "health_14d_vet",
    });

    // What the renderer says, verbatim — not a string this test invented.
    const { data: rendered } = await db.rpc("guarantee_text_for", {
      g_kind: "template",
      g_template_key: "health_14d_vet",
    });
    const expected = (rendered as { headline: string; remedy_sentence: string | null }[])[0];

    await page.goto(`/listing/${listingId}`);
    await expect(page.getByTestId("listing-guarantee-headline")).toHaveText(expected.headline, {
      timeout: 20_000,
    });
    await expect(page.getByTestId("listing-guarantee-remedy")).toHaveText(
      expected.remedy_sentence!,
    );
    // The platform does not vouch for the claim, and says so.
    await expect(page.getByTestId("listing-guarantee-panel")).toContainText(
      /does not examine animals/i,
    );

    await db.from("listings").delete().eq("id", listingId);
    await db.from("animal_eligibility").delete().eq("creature_id", creatureId);
    await db.from("creatures").delete().eq("id", creatureId);
  });

  /**
   * The terms were create-only: a seller published a deposit, a window and a
   * guarantee and could never change any of them again. Editing is safe because
   * orders freeze their own copy at creation, so a live sale keeps the deal it
   * was struck under.
   */
  test("published sale terms and guarantee can be edited afterwards", async ({ page }) => {
    const { db, userId } = await signInCached(SELLER_EMAIL);
    const stamp = Date.now();

    const creature = await db
      .from("creatures")
      .insert({ owner_id: userId, name: `E2E edit terms ${stamp}`, slug: `e2e-editterms-${stamp}` })
      .select("id")
      .single();
    const creatureId = creature.data!.id;
    await db.rpc("attest_animal_eligibility", { target_creature: creatureId });

    const listing = await db
      .from("listings")
      .insert({
        seller_id: userId,
        title: `E2E edit terms listing ${stamp}`,
        price_cents: 100000,
        creature_id: creatureId,
        deposit_bps: 1000,
        inspection_hours: 48,
      })
      .select("id")
      .single();
    const listingId = listing.data!.id;
    await db
      .from("listing_guarantees")
      .insert({ listing_id: listingId, kind: "template", template_key: "health_14d_vet" });

    await page.goto(`/listing/${listingId}/edit`);
    // Opens on what was actually published — not blank, which would invite a
    // seller to "keep" terms by leaving fields empty and silently reset them.
    await expect(page.getByTestId("listing-deposit")).toHaveValue("10", { timeout: 20_000 });
    await expect(page.getByTestId("listing-inspection-hours")).toHaveValue("48");
    await expect(page.getByTestId("guarantee-kind-template")).toBeChecked();

    await page.getByTestId("listing-deposit").fill("15");
    await page.getByTestId("listing-inspection-hours").fill("96");
    await page.getByTestId("guarantee-template-select").selectOption("congenital_1y_replace");
    await page.getByTestId("listing-submit").click();
    await expect(page).toHaveURL(new RegExp(`/listing/${listingId}$`), { timeout: 20_000 });

    const { data: after } = await db
      .from("listings")
      .select("deposit_bps,inspection_hours")
      .eq("id", listingId)
      .single();
    expect(after!.deposit_bps).toBe(1500);
    expect(after!.inspection_hours).toBe(96);

    const { data: g } = await db
      .from("listing_guarantees")
      .select("template_key")
      .eq("listing_id", listingId)
      .single();
    expect(g!.template_key).toBe("congenital_1y_replace");

    await db.from("listings").delete().eq("id", listingId);
    await db.from("animal_eligibility").delete().eq("creature_id", creatureId);
    await db.from("creatures").delete().eq("id", creatureId);
  });

  test("listing rejects junk price", async ({ page }) => {
    await page.goto("/compose");
    await page.getByRole("button", { name: /Listing/ }).click();
    await page.getByTestId("listing-title").fill("x");
    await page.getByTestId("listing-price").fill("abc");
    await page.getByTestId("listing-submit").click();
    await expect(page).toHaveURL(/compose/);
  });

  test("create brand → post as that brand → appears in feed", async ({ page }) => {
    const brandName = `E2E Brand ${Date.now()}`;
    const marker = `E2E brandpost ${Date.now()}`;

    await page.goto("/brands/new");
    await page.getByTestId("brand-name").fill(brandName);
    await page.getByTestId("brand-create-submit").click();
    await expect(page).toHaveURL(/\/compose/);

    // Switch identity to Brand; the new brand is auto-selected in the picker.
    await page.getByTestId("posting-as-selector").getByRole("button", { name: "Brand" }).click();
    await expect(page.getByTestId("brand-select")).toBeVisible();
    await expect(page.getByTestId("post-submit")).toBeEnabled();

    await page.getByTestId("post-body").fill(marker);
    await page.getByTestId("post-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
    await expect(page.getByText(marker)).toBeVisible();

    // Attribution is clickable → real public brand page with the post on it.
    await page.getByTestId("brand-attribution").filter({ hasText: brandName }).first().click();
    await expect(page).toHaveURL(/\/b\//);
    await expect(page.getByTestId("brand-profile-header").getByRole("heading", { name: brandName })).toBeVisible();
    await expect(page.getByText(marker)).toBeVisible();
  });
});

test("group member posts into a group from the main composer", async ({ page }) => {
  test.setTimeout(120_000);
  const { createClient } = await import("@supabase/supabase-js");
  const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
  const auth = await db.auth.signInWithPassword({
    email: SELLER_EMAIL,
    password: process.env.E2E_PASSWORD!,
  });
  const userId = auth.data.user!.id;
  // Idempotent join of a seeded group so the composer has one to offer.
  const { data: group } = await db
    .from("groups")
    .select("id,slug,name")
    .eq("slug", "german-shepherds")
    .single();
  await db.from("group_memberships").insert({ group_id: group!.id, profile_id: userId });

  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

  const marker = `E2E groupcompose ${Date.now()}`;
  await page.goto("/compose");
  await page.getByTestId("post-body").fill(marker);
  await page.getByTestId("post-group-select").selectOption({ label: group!.name });
  await page.getByTestId("post-submit").click();

  // A group post lands on the group timeline, not the home feed.
  await expect(page).toHaveURL(/\/groups\/german-shepherds/, { timeout: 20_000 });
  await expect(page.getByText(marker)).toBeVisible();

  // Cleanup MUST be asserted — a silent no-op left reviews on a public
  // profile once already. Soft delete hides the row from every timeline.
  const { data: mine } = await db
    .from("posts")
    .select("id")
    .eq("author_id", userId)
    .eq("body", marker)
    .single();
  const del = await db.rpc("soft_delete_managed_post", { target_post_id: mine!.id });
  expect(del.error).toBeNull();
  expect(del.data).toBe(true);
});
