import { expect, test } from "@playwright/test";
import { MEMBER_EMAIL, MEMBER_USERNAME, signInCached } from "./fixtures";

/**
 * Phase E auth hardening: login lockout, server-side password rule, the
 * species-interest screen, person covers, and the PWA manifest.
 *
 * Copy is asserted through KEYS (`data-error`) and test ids, never through
 * translated sentences — this lane cannot edit messages/*.json, so a spec that
 * pinned wording would fail on a string it does not own.
 */

test("five bad passwords lock the address, and the form says lock, not typo", async ({
  page,
}) => {
  test.setTimeout(120_000);
  // An address this test invents. NEVER a fixture account: a lockout lasts 15
  // minutes and would strand every other spec that signs in as it.
  const email = `e2e-lockout-${Date.now()}@scrlpets.invalid`;

  await page.goto("/login");
  const emailField = page.getByLabel("Email address");
  const passwordField = page.getByLabel("Password");
  const error = page.getByTestId("auth-error");

  for (let attempt = 1; attempt <= 4; attempt++) {
    await emailField.fill(email);
    await passwordField.fill(`wrong-password-${attempt}`);
    await page.getByTestId("auth-submit").click();
    await expect(error).toHaveAttribute("data-error", "invalid_credentials", {
      timeout: 20_000,
    });
  }

  // The fifth failure is the one that trips the lock, and the answer changes in
  // the same breath instead of after another wasted attempt.
  await passwordField.fill("wrong-password-5");
  await page.getByTestId("auth-submit").click();
  await expect(error).toHaveAttribute("data-error", "locked_out", { timeout: 20_000 });

  // A later attempt is refused BEFORE the credentials are tried at all.
  await page.reload();
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill("wrong-password-6");
  await page.getByTestId("auth-submit").click();
  await expect(page.getByTestId("auth-error")).toHaveAttribute("data-error", "locked_out", {
    timeout: 20_000,
  });
});

test("the password rule is stated before submitting and enforced on the server", async ({
  page,
}) => {
  await page.goto("/login?mode=signup");
  // Stated up front, not discovered in an error afterwards.
  await expect(page.getByTestId("password-rule")).toBeVisible();
  await expect(page.getByLabel("Password")).toHaveAttribute("minlength", "8");

  // Long enough to clear the browser's own minlength, so the ONLY thing that
  // can refuse this is the server action: eight letters, no digit.
  await page.getByLabel("Email address").fill(`e2e-weak-${Date.now()}@scrlpets.invalid`);
  await page.getByLabel("Password").fill("abcdefgh");
  await page.getByTestId("age-confirmation").check();
  await page.getByTestId("auth-submit").click();

  await expect(page.getByTestId("auth-error")).toHaveAttribute("data-error", "weak_password", {
    timeout: 20_000,
  });
  // Refused means refused: no account, so no verification screen.
  await expect(page.getByTestId("auth-submit")).toBeVisible();
});

test("onboarding pre-selects no species and skipping still counts as answered", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { db, userId } = await signInCached(MEMBER_EMAIL);

  // This spec borrows the member's onboarding columns and puts them back
  // exactly as found. Nothing else reads them — they shipped with Phase E —
  // and every worker has its own member account.
  const reset = await db
    .from("profiles")
    .update({ onboarded_at: null, species_interests: [] })
    .eq("id", userId);
  expect(reset.error).toBeNull();

  await page.goto("/login");
  await page.getByLabel("Email address").fill(MEMBER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

  await page.goto("/onboarding?next=%2Fsaved");
  await expect(page.getByTestId("onboarding-species")).toBeVisible({ timeout: 20_000 });

  // THE requirement: nothing is chosen for the person. A pre-ticked species
  // would answer the question before they read it.
  const chips = page.locator('[data-testid^="onboarding-species-"]');
  await expect(chips).toHaveCount(8);
  await expect(page.locator('[data-testid^="onboarding-species-"][aria-pressed="true"]')).toHaveCount(0);

  await page.getByTestId("onboarding-skip").click();
  await expect(page).toHaveURL("http://localhost:3000/saved", { timeout: 20_000 });

  const after = await db
    .from("profiles")
    .select("onboarded_at,species_interests")
    .eq("id", userId)
    .single();
  expect(after.error).toBeNull();
  expect(after.data!.onboarded_at).not.toBeNull();
  expect(after.data!.species_interests).toEqual([]);

  // Answered once: coming back redirects instead of asking again.
  await page.goto("/onboarding?next=%2Fsaved");
  await expect(page).toHaveURL("http://localhost:3000/saved", { timeout: 20_000 });

  const restored = await db
    .from("profiles")
    .update({ onboarded_at: null, species_interests: [] })
    .eq("id", userId);
  expect(restored.error, "restoring the member's onboarding columns").toBeNull();
});

test("a person's cover photo renders on their profile", async ({ page }) => {
  test.setTimeout(120_000);
  const { db, userId } = await signInCached(MEMBER_EMAIL);
  // Inline pixel: proves the render path without writing to storage, and it
  // cannot 404 the way a made-up bucket URL would.
  const cover =
    "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

  const set = await db.from("profiles").update({ cover_url: cover }).eq("id", userId);
  expect(set.error).toBeNull();

  await page.goto(`/u/${MEMBER_USERNAME}`);
  const banner = page.getByTestId("profile-cover");
  await expect(banner).toBeVisible({ timeout: 20_000 });
  await expect(banner).toHaveAttribute("src", cover);

  const cleared = await db.from("profiles").update({ cover_url: null }).eq("id", userId);
  expect(cleared.error, "clearing the member's cover").toBeNull();
  await page.goto(`/u/${MEMBER_USERNAME}`);
  await expect(page.getByTestId("profile-header")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("profile-cover")).toHaveCount(0);
});

test("the app is installable and ships nothing that pretends to work offline", async ({
  page,
}) => {
  const response = await page.request.get("/manifest.webmanifest");
  expect(response.ok()).toBe(true);
  const manifest = await response.json();
  expect(manifest.name).toBe("Scrlpets");
  expect(manifest.start_url).toBe("/");
  expect(manifest.display).toBe("standalone");
  // Chromium's install criteria: a 192 and a 512.
  const sizes = (manifest.icons as { sizes: string }[]).map((icon) => icon.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");

  await page.goto("/");
  await expect(page.locator('link[rel="manifest"]')).toHaveCount(1);

  await page.goto("/install");
  await expect(page.getByTestId("install-truth")).toBeVisible({ timeout: 20_000 });
  // Offline is BANKED. No service worker is registered, so nothing can claim it.
  const workers = await page.evaluate(() =>
    navigator.serviceWorker.getRegistrations().then((list) => list.length),
  );
  expect(workers).toBe(0);
});
