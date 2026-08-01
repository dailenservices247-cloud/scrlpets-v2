import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { SELLER_EMAIL, signInCached } from "./fixtures";

/**
 * Phase E — support submission + the two public policy pages.
 *
 * Every ticket this file asserts on is one it filed itself, keyed by a
 * `Date.now()` marker in the subject. Nothing here reads a shared fixture row,
 * counts the queue, or asserts anything about the feed.
 *
 * Copy assertions are deliberately absent: the strings live in messages/*.json
 * and this lane does not own that file. The behaviour is asserted through
 * test ids and data attributes instead, which survive the i18n merge.
 */

// URL assertions are regex, not the literal http://localhost:3000 the older
// specs hardcode: this file has to be runnable against whichever port the
// server of the moment came up on.
async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL(/localhost:\d+\/$/, { timeout: 20_000 });
}

async function fillTicket(page: Page, subject: string) {
  await page.getByTestId("support-subject").fill(subject);
  await page
    .getByTestId("support-message")
    .fill("Filed by the support-policy spec. Long enough to clear the check constraint.");
  await page.getByTestId("support-category").selectOption("bug");
}

test("the menu's Support link resolves to a working form", async ({ page }) => {
  await page.goto("/menu");
  // Scoped to app-shell on purpose. Support is now linked from the footer too —
  // that is the point of the footer, and it is what makes /support reachable
  // from every route rather than only from the menu. A bare a[href="/support"]
  // therefore matches twice and fails strict mode. This test is about the MENU
  // row, per its own name, so it says so.
  await page.getByTestId("app-shell").locator('a[href="/support"]').click();
  await expect(page).toHaveURL(/\/support$/);
  await expect(page.getByTestId("support-form")).toBeVisible();
  await expect(page.getByTestId("support-expectations")).toBeVisible();
});

test("a signed-out guest can file a ticket and gets a reference", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/support");

  // A guest types their own address — the field is theirs to fill.
  const email = page.getByTestId("support-email");
  await expect(email).not.toHaveAttribute("readonly", /.*/);
  await email.fill("guest-spec@example.com");
  await page.getByTestId("support-name").fill("Guest Spec");
  await fillTicket(page, `E2E guest ticket ${Date.now()}`);
  await page.getByTestId("support-submit").click();

  // The reference exists even though `anon` has no SELECT policy on the table:
  // the action supplies the row id rather than reading it back.
  await expect(page.getByTestId("support-sent")).toBeVisible();
  await expect(page.getByTestId("support-reference")).toHaveText(/^[0-9A-F]{8}$/);
});

test("a signed-in ticket links to the profile and keeps the account address", async ({
  page,
}) => {
  const marker = `E2E member ticket ${Date.now()}`;
  await signIn(page, SELLER_EMAIL);
  await page.goto("/support");

  // The address is pinned to the account, so it is shown but not editable.
  const email = page.getByTestId("support-email");
  await expect(email).toHaveAttribute("readonly", /.*/);
  await expect(email).toHaveValue(SELLER_EMAIL);

  // Force a different address past the readonly attribute. The server must
  // ignore it — otherwise the confirmation is an open relay.
  await page.getByTestId("support-email").evaluate((node) => {
    const input = node as HTMLInputElement;
    input.removeAttribute("readonly");
    input.value = "attacker@example.com";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await fillTicket(page, marker);
  await page.getByTestId("support-submit").click();
  await expect(page.getByTestId("support-sent")).toBeVisible();

  const { db, userId } = await signInCached(SELLER_EMAIL);
  const row = await db
    .from("support_tickets")
    .select("profile_id,email,category,status")
    .eq("subject", marker)
    .single();
  expect(row.error).toBeNull();
  expect(row.data!.profile_id).toBe(userId);
  expect(row.data!.email).toBe(SELLER_EMAIL);
  expect(row.data!.category).toBe("bug");
  expect(row.data!.status).toBe("open");
});

test("the page does not claim a confirmation email it cannot send", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/support");

  // RESEND_API_KEY / SUPPORT_FROM_EMAIL are unset in this environment, so the
  // capability notice must be on the page BEFORE anyone submits.
  await expect(page.getByTestId("support-email-not-configured")).toBeVisible();

  await page.getByTestId("support-name").fill("Guest Spec");
  await page.getByTestId("support-email").fill("guest-spec@example.com");
  await fillTicket(page, `E2E no-email ticket ${Date.now()}`);
  await page.getByTestId("support-submit").click();

  await expect(page.getByTestId("support-email-state")).toHaveAttribute(
    "data-email-sent",
    "false",
  );
});

test("FAQ and guidelines are public and carry a real last-updated date", async ({ page }) => {
  await page.context().clearCookies();

  await page.goto("/faq");
  await expect(page.getByTestId("faq-list").locator("section")).toHaveCount(10);
  await expect(page.getByTestId("faq-updated")).toHaveAttribute(
    "datetime",
    /^\d{4}-\d{2}-\d{2}$/,
  );
  // The two claims most likely to drift into a lie get their own anchors.
  await expect(page.getByTestId("faq-identity")).toBeVisible();
  await expect(page.getByTestId("faq-health")).toBeVisible();

  await page.goto("/guidelines");
  await expect(page.getByTestId("guidelines-list").locator("section")).toHaveCount(9);
  await expect(page.getByTestId("guidelines-updated")).toHaveAttribute(
    "datetime",
    /^\d{4}-\d{2}-\d{2}$/,
  );
  await expect(page.getByTestId("guidelines-enforcement")).toBeVisible();
});

test("support and policy pages have no serious/critical a11y violations", async ({ page }) => {
  for (const path of ["/support", "/faq", "/guidelines"]) {
    await page.goto(path);
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    const serious = results.violations.filter(
      (v) => v.impact === "serious" || v.impact === "critical",
    );
    expect(
      serious,
      `${path}: ${JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })))}`,
    ).toEqual([]);
  }
});
