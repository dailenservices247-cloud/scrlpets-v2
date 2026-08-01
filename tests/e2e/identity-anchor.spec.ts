import { expect, test } from "@playwright/test";
import { MEMBER_EMAIL, SELLER_EMAIL, signInCached } from "./fixtures";

/**
 * The identity anchor (20260801174832_identity_anchor.sql).
 *
 * Every animal here is created BY THIS FILE and archived at the end — the
 * anchor value is globally unique, so borrowing a seeded creature would burn a
 * shared row's one anchor slot and leave the next run's registration failing on
 * a duplicate it never wrote. Values carry the run stamp for the same reason.
 *
 * Assertions read `data-assurance` and testids, never the rendered copy: the
 * copy is translated and the state is what the migration actually guarantees.
 */

async function createAnimal(
  db: Awaited<ReturnType<typeof signInCached>>["db"],
  ownerId: string,
  slug: string,
): Promise<string> {
  const { data, error } = await db
    .from("creatures")
    .insert({ owner_id: ownerId, name: slug, slug, species: "cockatiel", page_visible: true })
    .select("id")
    .single();
  expect(error, `creating ${slug}`).toBeNull();
  return data!.id as string;
}

async function archiveAnimal(
  db: Awaited<ReturnType<typeof signInCached>>["db"],
  creatureId: string,
) {
  const archived = await db.rpc("archive_creature", {
    target_creature: creatureId,
    archived: true,
  });
  expect(archived.error, "archiving the test animal").toBeNull();
}

test("the owner registers a typed anchor, the level moves to anchored, and a duplicate value is refused", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const value = `E2E-ANCHOR-${stamp}`;
  const { db, userId } = await signInCached(SELLER_EMAIL);

  const slugA = `e2e-anchor-a-${stamp}`;
  const slugB = `e2e-anchor-b-${stamp}`;
  const idA = await createAnimal(db, userId, slugA);
  const idB = await createAnimal(db, userId, slugB);

  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

  // A fresh animal has no marker and no litter/birth date: the weakest level.
  await page.goto(`/c/${slugA}`);
  await expect(page.getByTestId("assurance")).toHaveAttribute("data-assurance", "declared", {
    timeout: 20_000,
  });
  await expect(page.getByTestId("anchor-owner-empty")).toBeVisible();

  // A bird keeper registers a LEG BAND, not a microchip — the type list is
  // species-neutral, which is the whole reason the anchor is typed.
  await page.getByTestId("anchor-edit-open").click();
  await page.getByTestId("anchor-input-type").selectOption("leg_band");
  await page.getByTestId("anchor-input-value").fill(value);
  await page.getByTestId("anchor-save").click();

  await expect(page.getByTestId("assurance")).toHaveAttribute("data-assurance", "anchored", {
    timeout: 20_000,
  });
  await expect(page.getByTestId("assurance-marker")).toBeVisible();
  // The keeper — and only the keeper — gets the value back, for the vet.
  await expect(page.getByTestId("anchor-owner-value")).toHaveText(value);

  // Same owner, second animal, same number: refused with a message about the
  // collision rather than a raw Postgres error, and the level never moves.
  await page.goto(`/c/${slugB}`);
  await expect(page.getByTestId("anchor-edit-open")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("anchor-edit-open").click();
  await page.getByTestId("anchor-input-type").selectOption("microchip");
  await page.getByTestId("anchor-input-value").fill(value);
  await page.getByTestId("anchor-save").click();
  await expect(page.getByTestId("anchor-duplicate-error")).toBeVisible({ timeout: 20_000 });

  await page.reload();
  await expect(page.getByTestId("assurance")).toHaveAttribute("data-assurance", "declared", {
    timeout: 20_000,
  });

  await archiveAnimal(db, idA);
  await archiveAnimal(db, idB);
});

test("a signed-in non-owner gets yes/no on a scanned value and never the number itself", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const value = `E2E-SCAN-${stamp}`;
  const { db, userId } = await signInCached(SELLER_EMAIL);

  const anchoredSlug = `e2e-scan-anchored-${stamp}`;
  const bareSlug = `e2e-scan-bare-${stamp}`;
  const anchoredId = await createAnimal(db, userId, anchoredSlug);
  const bareId = await createAnimal(db, userId, bareSlug);

  // Set through UPDATE, which is the privilege the migration grants on these
  // two columns — the seller owns the row, so RLS lets it through.
  const written = await db
    .from("creatures")
    .update({ anchor_type: "microchip", anchor_value: value })
    .eq("id", anchoredId);
  expect(written.error, "registering the anchor").toBeNull();

  await page.goto("/login");
  await page.getByLabel("Email address").fill(MEMBER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

  await page.goto(`/c/${anchoredSlug}`);
  await expect(page.getByTestId("assurance")).toHaveAttribute("data-assurance", "anchored", {
    timeout: 20_000,
  });
  // The visitor sees THAT there is a marker, never WHICH — the number is not in
  // the payload at all, so no client-side hiding is being trusted here.
  await expect(page.getByTestId("anchor-owner-value")).toHaveCount(0);
  expect(await page.content()).not.toContain(value);

  await page.getByTestId("anchor-verify-input").fill(`${value}-WRONG`);
  await page.getByTestId("anchor-verify-submit").click();
  await expect(page.getByTestId("anchor-verify-no-match")).toBeVisible({ timeout: 20_000 });

  await page.getByTestId("anchor-verify-input").fill(value);
  await page.getByTestId("anchor-verify-submit").click();
  await expect(page.getByTestId("anchor-verify-match")).toBeVisible({ timeout: 20_000 });

  // An animal with NO anchor answers with the identical no-match state, so a
  // caller cannot use the difference to learn whether one is registered.
  await page.goto(`/c/${bareSlug}`);
  await expect(page.getByTestId("anchor-verify-input")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("anchor-verify-input").fill(value);
  await page.getByTestId("anchor-verify-submit").click();
  await expect(page.getByTestId("anchor-verify-no-match")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("anchor-verify-match")).toHaveCount(0);

  await archiveAnimal(db, anchoredId);
  await archiveAnimal(db, bareId);
});
