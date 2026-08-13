import { test, expect } from "@playwright/test";
import { SELLER_EMAIL } from "./fixtures";

// Local, matching every other spec that signs in through the UI — fixtures does
// not export one, and adding it there is a change to shared setup this does not
// need.
async function loginViaUi(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
}

/**
 * The first link in the commerce chain: create_order refuses a seller who cannot
 * receive payouts, and the transporter gate refuses a driver for the same
 * reason. Before this page existed there was no way to become payable at all.
 */
test.describe("payout settings", () => {
  test.describe.configure({ timeout: 120_000 });

  test("is reachable from settings and states the seller's position plainly", async ({ page }) => {
    await loginViaUi(page, SELLER_EMAIL);
    await page.goto("/settings");

    const row = page.getByRole("link", { name: /Payouts/i });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await row.click();
    await expect(page).toHaveURL(/\/settings\/payouts$/, { timeout: 20_000 });

    // Exactly one of the panels renders — never a blank page. Which one depends
    // on whether Stripe keys are present in this environment, and both are
    // legitimate answers; what is not legitimate is saying nothing.
    const configured = page.getByTestId("payout-settings");
    const unavailable = page.getByTestId("payouts-unconfigured");
    const shown = (await configured.count()) + (await unavailable.count());
    expect(shown, "the page must state something").toBe(1);

    if ((await configured.count()) === 1) {
      // The four states are told apart deliberately: "not enabled" would flatten
      // never-started, still-under-review, and previously-working-now-lapsed,
      // which need different actions from the seller.
      const states = ["none", "started", "review", "ready"];
      const visible = await Promise.all(
        states.map((s) => page.getByTestId(`payout-state-${s}`).count()),
      );
      expect(visible.reduce((a, b) => a + b, 0), "exactly one state is claimed").toBe(1);

      // Scrlpets must never imply it holds bank details — Stripe does.
      await expect(configured).toContainText(/never sees your account number/i);
    }
  });

  test("signed-out cannot reach it", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/settings/payouts");
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  });
});
