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
  await page.getByTestId("tile-destination-listing").first().click();
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
