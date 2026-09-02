import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { SELLER_EMAIL, SELLER_PROFILE_ID, SELLER_USERNAME } from "./fixtures";

/**
 * 20260801171418 withheld `username` from the self-writable allowlist because a
 * rename is "both an impersonation vector and a link-rot one". Renaming is now
 * allowed, so the redirect is half the answer to that objection.
 *
 * THE RENAME ITSELF IS NOT EXERCISED HERE, deliberately. An earlier version of
 * this spec renamed a fixture account and broke profile-highlights.spec, which
 * asserts `@THIRD_USERNAME` appears in a follower list — a spec that renames a
 * shared account is a spec that fails its neighbours at random. The rules are
 * owned by username_rename.probe.sql (7 assertions, negative-controlled). What
 * only a browser can prove is the ROUTE, and that needs a history row, not a
 * rename.
 */
test.describe("retired handles", () => {
  test.describe.configure({ timeout: 90_000 });

  const retired = `e2eretired${Date.now().toString().slice(-6)}`;

  test("an old handle redirects to the current one instead of 404ing", async ({ page }) => {
    test.skip(!process.env.SUPABASE_SERVICE_ROLE_KEY, "needs SUPABASE_SERVICE_ROLE_KEY");
    const db = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const ins = await db
      .from("username_history")
      .insert({ username: retired, profile_id: SELLER_PROFILE_ID });
    expect(ins.error, "fixture history row must exist or this proves nothing").toBeNull();

    try {
      await page.goto(`/u/${retired}`);
      await expect(page).toHaveURL(new RegExp(`/u/${SELLER_USERNAME}$`), { timeout: 20_000 });
    } finally {
      await db.from("username_history").delete().eq("username", retired);
    }
  });

  test("a handle nobody ever held is still a 404, not a redirect", async ({ page }) => {
    // The inverse. Without it, a redirect that fired for EVERY unknown handle
    // would pass the test above and hide a real bug.
    const res = await page.goto("/u/e2eneverexisted999");
    expect(res?.status()).toBe(404);
  });

  test("the form refuses a reserved handle without a round trip", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(SELLER_EMAIL);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

    await page.goto("/settings/profile");
    await expect(page.getByTestId("username-input")).toBeVisible({ timeout: 20_000 });
    await page.getByTestId("username-input").fill("admin");
    // Disabled, not an error after submitting: the shared validator refuses it
    // in the form, so nothing is sent and no fixture state moves.
    await expect(page.getByTestId("username-save")).toBeDisabled();
  });
});
