import { expect, test } from "@playwright/test";
import { SELLER_EMAIL, signInCached } from "./fixtures";

/**
 * An animal's own picture. `creatures.avatar_url` was read in eight query sites
 * and written by nothing, so every animal rendered as a letter.
 *
 * The animal here is created BY THIS FILE and archived at the end. Borrowing a
 * seeded creature would leave a shared row carrying this run's photo, and the
 * next run would assert against it.
 *
 * The load-bearing case is the last one: editing an unrelated field must not
 * blank the picture. That is the failure mode the profile editor's shape
 * (`if (avatarUrl) ...`) cannot even express, and the reason resolveAvatarPatch
 * exists.
 */

const PHOTO = "https://example.test/e2e-creature-photo.jpeg";

test("an owner can put a photo on their animal and take it back down", async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const slug = `e2e-photo-${stamp}`;
  const { db, userId } = await signInCached(SELLER_EMAIL);

  const created = await db
    .from("creatures")
    .insert({ owner_id: userId, name: slug, slug, species: "cockatiel", page_visible: true })
    .select("id")
    .single();
  expect(created.error, "creating the test animal").toBeNull();
  const creatureId = created.data!.id as string;

  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

  // ---------------------------------------------- 1. no photo, nothing to remove
  await page.goto(`/c/${slug}`);
  await page.getByTestId("about-edit-open").click();
  await expect(page.getByTestId("media-input")).toBeVisible({ timeout: 20_000 });
  // Remove is offered only when there is something to remove.
  await expect(page.getByTestId("about-photo-remove")).toHaveCount(0);

  // ---------------------------------------------- 2. the picker refuses video
  // An avatar renders through <img>; a video here would set a photo that
  // silently fails to display in all eight read sites.
  await expect(page.getByTestId("media-input")).toHaveAttribute(
    "accept",
    "image/jpeg,image/png,image/webp",
  );

  // ---------------------------------------------- 3. with a photo, Remove appears
  const seeded = await db.from("creatures").update({ avatar_url: PHOTO }).eq("id", creatureId);
  expect(seeded.error, "seeding the photo").toBeNull();

  await page.goto(`/c/${slug}`);
  await page.getByTestId("about-edit-open").click();
  await expect(page.getByTestId("about-photo-remove")).toBeVisible({ timeout: 20_000 });

  // ---------------------------------------------- 4. an unrelated edit KEEPS it
  // The regression guard. Changing the colour must not blank the picture.
  await page.getByTestId("about-input-color").fill("Pied");
  await page.getByTestId("about-save").click();
  // The dialog closing is the save completing. `about-edit-open` is visible
  // BEHIND the open dialog, so waiting on it passes instantly and races the
  // write — which is exactly how this test failed the first time.
  await expect(page.getByTestId("about-edit-dialog")).toHaveCount(0, { timeout: 20_000 });

  const afterUnrelated = await db
    .from("creatures")
    .select("avatar_url,color")
    .eq("id", creatureId)
    .single();
  expect(afterUnrelated.error).toBeNull();
  expect(afterUnrelated.data!.color, "the unrelated edit landed").toBe("Pied");
  expect(afterUnrelated.data!.avatar_url, "the photo survived an unrelated edit").toBe(PHOTO);

  // ---------------------------------------------- 5. removing clears the column
  await page.goto(`/c/${slug}`);
  await page.getByTestId("about-edit-open").click();
  await page.getByTestId("about-photo-remove").click();
  // Once removal is pending the picker is out of the way, so the two intents
  // cannot both be armed at once.
  await expect(page.getByTestId("about-photo-pending-removal")).toBeVisible();
  await expect(page.getByTestId("media-input")).toHaveCount(0);
  await page.getByTestId("about-save").click();
  // The dialog closing is the save completing. `about-edit-open` is visible
  // BEHIND the open dialog, so waiting on it passes instantly and races the
  // write — which is exactly how this test failed the first time.
  await expect(page.getByTestId("about-edit-dialog")).toHaveCount(0, { timeout: 20_000 });

  const afterRemoval = await db
    .from("creatures")
    .select("avatar_url")
    .eq("id", creatureId)
    .single();
  expect(afterRemoval.error).toBeNull();
  expect(afterRemoval.data!.avatar_url, "the photo was cleared").toBeNull();

  const archived = await db.rpc("archive_creature", {
    target_creature: creatureId,
    archived: true,
  });
  expect(archived.error, "archiving the test animal").toBeNull();
});

/**
 * The production failure this guards against: the action POST came back 503
 * from the edge, so the await threw and every line after it in the submit
 * handler was skipped. No busy reset, no error, no close — a dialog that sat
 * there silently. The copy written for exactly this moment could only ever
 * render for a clean {ok:false}.
 *
 * A failed save SHOULD leave the dialog open — closing it would throw away
 * what the person typed. What it must not do is stay silent.
 */
test("a save that fails at the network layer says so instead of hanging", async ({ page }) => {
  test.setTimeout(120_000);
  const stamp = Date.now();
  const slug = `e2e-savefail-${stamp}`;
  const { db, userId } = await signInCached(SELLER_EMAIL);

  const created = await db
    .from("creatures")
    .insert({ owner_id: userId, name: slug, slug, species: "cockatiel", page_visible: true })
    .select("id")
    .single();
  expect(created.error, "creating the test animal").toBeNull();
  const creatureId = created.data!.id as string;

  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

  await page.goto(`/c/${slug}`);
  await page.getByTestId("about-edit-open").click();
  await expect(page.getByTestId("about-edit-dialog")).toHaveCount(1, { timeout: 20_000 });

  // Reproduce the edge answering before the function does. Server actions POST
  // to the page's own URL.
  await page.route(`**/c/${slug}`, async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 503, contentType: "text/plain", body: "" });
      return;
    }
    await route.continue();
  });

  await page.getByTestId("about-input-color").fill("Pied");
  await page.getByTestId("about-save").click();

  // The person is told. This is the assertion that fails without settleAction.
  await expect(page.getByText(/Couldn.t save/i)).toBeVisible({ timeout: 20_000 });
  // The dialog stays open on purpose — their typing is still in it.
  await expect(page.getByTestId("about-edit-dialog")).toHaveCount(1);
  // And the button is usable again rather than stuck on "Saving…".
  await expect(page.getByTestId("about-save")).toBeEnabled();

  await page.unroute(`**/c/${slug}`);
  const archived = await db.rpc("archive_creature", {
    target_creature: creatureId,
    archived: true,
  });
  expect(archived.error, "archiving the test animal").toBeNull();
});
