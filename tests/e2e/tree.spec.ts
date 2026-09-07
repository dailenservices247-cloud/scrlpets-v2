import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { SELLER_EMAIL, SELLER_USERNAME, signInCached } from "./fixtures";

function databaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function signIn(email: string) {
  return signInCached(email);
}

async function loginViaUi(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
}

test("own tree: generation rows, founder badge, memorial treatment", async ({ page }) => {
  test.setTimeout(120_000);
  const seller = await signIn(SELLER_EMAIL);
  const stamp = Date.now();

  // Two linked animals via the RPCs — API-style setup, same shape as
  // pack-alumni-spine.spec.ts. The founder is parentless breeding stock (the
  // only combination is_founder recognizes); the offspring is linked to it.
  const founder = await seller.db
    .from("creatures")
    .insert({
      owner_id: seller.userId,
      name: `E2E Founder ${stamp}`,
      slug: `e2e-tree-founder-${stamp}`,
      species: "Dog",
      creature_role: "breeding",
    })
    .select("id")
    .single();
  expect(founder.error).toBeNull();
  const founderId = founder.data!.id;

  const offspring = await seller.db
    .from("creatures")
    .insert({
      owner_id: seller.userId,
      name: `E2E Offspring ${stamp}`,
      slug: `e2e-tree-offspring-${stamp}`,
      species: "Dog",
    })
    .select("id")
    .single();
  expect(offspring.error).toBeNull();
  const offspringId = offspring.data!.id;

  const link = await seller.db.rpc("link_creature_parent", {
    target_creature: offspringId,
    target_parent: founderId,
    link_type: "sire",
  });
  expect(link.error).toBeNull();

  await loginViaUi(page, SELLER_EMAIL);
  await page.goto("/tree");
  await expect(page.getByTestId("tree-header")).toBeVisible();

  // Generation rows: the founder's Gen 1 and the offspring's Gen 2.
  await expect(page.getByTestId("tree-generation-row")).toHaveCount(2, { timeout: 15_000 });
  const founderCard = page.getByTestId(`tree-card-link-${founderId}`);
  const offspringCard = page.getByTestId(`tree-card-link-${offspringId}`);
  await expect(founderCard).toBeVisible();
  await expect(offspringCard).toBeVisible();

  // Founder badge on the parentless breeding animal only.
  await expect(founderCard.getByTestId("tree-founder-badge")).toBeVisible();
  await expect(offspringCard.getByTestId("tree-founder-badge")).toHaveCount(0);

  // Memorial treatment appears after the animal is marked deceased.
  const deceased = await seller.db
    .from("creatures")
    .update({ deceased_at: "2024-01-01" }, { count: "exact" })
    .eq("id", offspringId);
  expect(deceased.count).toBe(1);

  await page.reload();
  await expect(
    page.getByTestId(`tree-card-link-${offspringId}`).getByTestId("tree-memorial-label"),
  ).toBeVisible();

  // Cleanup — asserted, no hard delete exists on creatures.
  const hide = await seller.db
    .from("creatures")
    .update({ page_visible: false }, { count: "exact" })
    .in("id", [founderId, offspringId]);
  expect(hide.count).toBe(2);
});

test("visitor tree honors private tree_privacy", async ({ browser }) => {
  test.setTimeout(60_000);
  const seller = await signIn(SELLER_EMAIL);

  const setPrivate = await seller.db
    .from("profiles")
    .update({ tree_privacy: "private" }, { count: "exact" })
    .eq("id", seller.userId);
  expect(setPrivate.count).toBe(1);

  // Fresh, signed-out context so this is a real guest read, independent of
  // any session another test in this file left behind.
  const context = await browser.newContext();
  const guestPage = await context.newPage();
  await guestPage.goto(`/u/${SELLER_USERNAME}/tree`);
  await expect(guestPage.getByTestId("tree-private-notice")).toBeVisible();
  await context.close();

  // Restore — asserted, not a silent no-op.
  const restore = await seller.db
    .from("profiles")
    .update({ tree_privacy: "public" }, { count: "exact" })
    .eq("id", seller.userId);
  expect(restore.count).toBe(1);
});

test("a recorded ancestor joins the tree but not the public roster", async ({ page, browser }) => {
  test.setTimeout(120_000);
  const seller = await signIn(SELLER_EMAIL);
  const stamp = Date.now();

  // The count BEFORE, read from the live profile — robust against whatever the
  // fixture owner already has, and the only honest baseline for "+1 not +2".
  const guestContext = await browser.newContext();
  const guest = await guestContext.newPage();
  await guest.goto(`/u/${SELLER_USERNAME}`);
  // The testid is on the tile, which also carries the "Animals" label — read the
  // <dd> that holds the number, or the baseline is NaN and every comparison
  // below silently compares against "NaN".
  const animalCount = guest.getByTestId("metric-animals").locator("dd");
  const before = Number(await animalCount.innerText());
  expect(Number.isInteger(before)).toBe(true);

  // One animal the breeder OWNS and one ancestor they are only RECORDING —
  // the pair is the point. A test with the ancestor alone would pass against a
  // profile query that had simply stopped returning anything.
  const mine = await seller.db
    .from("creatures")
    .insert({
      owner_id: seller.userId,
      name: `E2E Mine ${stamp}`,
      slug: `e2e-roster-mine-${stamp}`,
      species: "Dog",
    })
    .select("id")
    .single();
  expect(mine.error).toBeNull();
  const mineId = mine.data!.id;

  const ancestor = await seller.db
    .from("creatures")
    .insert({
      owner_id: seller.userId,
      name: `E2E Ancestor ${stamp}`,
      slug: `e2e-roster-ancestor-${stamp}`,
      species: "Dog",
      creature_role: "breeding",
      in_roster: false,
    })
    .select("id")
    .single();
  expect(ancestor.error).toBeNull();
  const ancestorId = ancestor.data!.id;

  const link = await seller.db.rpc("link_creature_parent", {
    target_creature: mineId,
    target_parent: ancestorId,
    link_type: "sire",
  });
  expect(link.error).toBeNull();

  // The tree KEEPS the ancestor — recording a pedigree is what it is for.
  await loginViaUi(page, SELLER_EMAIL);
  await page.goto("/tree");
  await expect(page.getByTestId(`tree-card-link-${ancestorId}`)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByTestId(`tree-card-link-${mineId}`)).toBeVisible();

  // The public profile does not: not in the count, not in the rail, not in the
  // pets tab. The owned animal added alongside it proves the filter
  // discriminates rather than just returning less.
  await guest.goto(`/u/${SELLER_USERNAME}`);
  // +1, not +2: two animals were inserted and only the one they own counts.
  await expect(animalCount).toHaveText(String(before + 1));
  await expect(guest.getByTestId("animal-rail").getByText(`E2E Mine ${stamp}`)).toBeVisible();
  await expect(guest.getByTestId("animal-rail").getByText(`E2E Ancestor ${stamp}`)).toHaveCount(0);

  await guest.goto(`/u/${SELLER_USERNAME}?tab=pets`);
  await expect(guest.getByTestId("pets-list").getByText(`E2E Mine ${stamp}`)).toBeVisible();
  await expect(guest.getByTestId("pets-list").getByText(`E2E Ancestor ${stamp}`)).toHaveCount(0);
  await guestContext.close();

  // Cleanup — asserted, no hard delete exists on creatures. archived_at is what
  // takes them off the profile now, which page_visible alone would not do.
  const archive = await seller.db
    .from("creatures")
    .update({ archived_at: new Date().toISOString(), page_visible: false }, { count: "exact" })
    .in("id", [mineId, ancestorId]);
  expect(archive.count).toBe(2);
});
