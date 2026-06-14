import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

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
});

test("composer has no serious/critical a11y violations", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("email").fill(process.env.E2E_EMAIL!);
  await page.getByPlaceholder("password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("http://localhost:3000/");
  await page.goto("/compose");
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
  await page.goto("/login");
  await page.getByPlaceholder("email").fill(process.env.E2E_EMAIL!);
  await page.getByPlaceholder("password").fill(process.env.E2E_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL("http://localhost:3000/");
  await page.goto("/messages");
  await expectNoSerious(page);
});
