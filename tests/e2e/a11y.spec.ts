import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SELLER_EMAIL } from "./fixtures";

async function expectNoSerious(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(serious, JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2)).toEqual([]);
}

test("feed has no serious/critical a11y violations", async ({ page }) => {
  await page.goto("/");
  await expectNoSerious(page);
});

test("login has no serious/critical a11y violations", async ({ page }) => {
  await page.goto("/login");
  await expectNoSerious(page);
  await page.goto("/forgot-password");
  await expectNoSerious(page);
  await page.goto("/reset-password");
  await expectNoSerious(page);
});

test("composer has no serious/critical a11y violations", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL("http://localhost:3000/");
  await page.goto("/compose");
  await expectNoSerious(page);
});

test("feed destination page has no serious/critical a11y violations", async ({ page }) => {
  await page.goto("/");
  // Pinned to a seeded listing, not whatever the feed happens to show: E2E rows
  // are created and soft-deleted by other workers mid-run, so `.first()` can
  // click a tile whose listing is gone by the time the route renders.
  //
  // FILTER ON THE CARD, NOT THE LINK. `tile-destination-listing` is the action
  // <Link>, whose only text is a translated label and an aria-hidden icon — it
  // never contains the title, so `hasNotText: "E2E "` matched every tile and
  // excluded nothing. The mitigation above was written, and did nothing; the
  // race it describes stayed live and this test failed intermittently on a 404.
  // `tile-listing` is the FeedCardShell, which does contain `item.title`, and
  // is the same shape comments.spec.ts and video-realms.spec.ts already use.
  await page
    .getByTestId("tile-listing")
    .filter({ hasNotText: "E2E " })
    .first()
    .getByTestId("tile-destination-listing")
    .click();
  // Tolerant: dev-mode first-compile of the destination route under load.
  await expect(page.getByTestId("destination-listing")).toBeVisible({ timeout: 20_000 });
  await expectNoSerious(page);
});

test("profile page has no serious/critical a11y violations", async ({ page }) => {
  await page.goto("/u/breeder_jane");
  await expectNoSerious(page);
});

test("creature page has no serious/critical a11y violations", async ({ page }) => {
  await page.goto("/c/max-c1");
  await expectNoSerious(page);
});

test("inbox has no serious/critical a11y violations", async ({ page }) => {
  test.setTimeout(60_000);
  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL("http://localhost:3000/");
  await page.goto("/messages");
  await expectNoSerious(page);
});

test("menu and shop shell pages have no serious/critical a11y violations", async ({ page }) => {
  await page.goto("/menu");
  await expectNoSerious(page);
  await page.goto("/shop");
  await expectNoSerious(page);
  await page.goto("/privacy");
  await expectNoSerious(page);
  await page.goto("/terms");
  await expectNoSerious(page);
});

test("the seeded onboarding path has no serious/critical a11y violations", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL("http://localhost:3000/");
  for (const route of ["/onboarding/breeder", "/hub", "/litters", "/settings"]) {
    // Status asserted first: a 404 page is trivially accessible, so without
    // this a mistyped route reads as a passing a11y check forever.
    const res = await page.goto(route);
    expect(res?.status(), `${route} did not resolve`).toBeLessThan(400);
    await expectNoSerious(page);
  }
});

test("guest discovery surfaces have no serious/critical a11y violations", async ({ page }) => {
  for (const route of ["/discover", "/market", "/services", "/guides", "/adopt", "/faq"]) {
    const res = await page.goto(route);
    expect(res?.status(), `${route} did not resolve`).toBeLessThan(400);
    await expectNoSerious(page);
  }
});

/**
 * The rest of the static routes — spec item 3's "then the rest".
 *
 * Split by auth because a signed-out visit to a protected route lands on
 * /login, and scanning the login page 12 times proves nothing about the route
 * you meant to check. Status is asserted before axe runs for the same reason a
 * 404 page is trivially accessible.
 *
 * `/admin` is deliberately absent: it needs an admin fixture that does not
 * exist, and granting admin to a test account would weaken the RBAC refusal
 * specs that depend on it.
 */
const GUEST_ROUTES = [
  "/groups",
  "/guidelines",
  "/install",
  "/jobs",
  "/market/offer",
  "/search",
  "/signup",
  "/support",
  "/tree",
  "/waitlist",
];

const SIGNED_IN_ROUTES = [
  "/applications",
  "/brand-os",
  "/brands/new",
  "/calendar",
  "/health",
  "/notifications",
  "/onboarding",
  "/pack",
  "/pack/alumni",
  "/rewards",
  "/saved",
  "/settings/account",
  "/settings/payouts",
  "/settings/profile",
  "/settings/referrals",
  "/settings/subscription",
  "/settings/verification",
];

test("every remaining guest route has no serious/critical a11y violations", async ({ page }) => {
  test.setTimeout(180_000);
  for (const route of GUEST_ROUTES) {
    const res = await page.goto(route);
    expect(res?.status(), `${route} did not resolve`).toBeLessThan(400);
    await expectNoSerious(page);
  }
});

test("every remaining signed-in route has no serious/critical a11y violations", async ({ page }) => {
  test.setTimeout(240_000);
  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL("http://localhost:3000/");
  for (const route of SIGNED_IN_ROUTES) {
    const res = await page.goto(route);
    expect(res?.status(), `${route} did not resolve`).toBeLessThan(400);
    await expectNoSerious(page);
  }
});
