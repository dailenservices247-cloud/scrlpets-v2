import { test, expect } from "@playwright/test";

// Cross-user realtime delivery verified manually (two sessions); these cover
// gating, thread creation, send, and persistence with the single E2E account.

test("signed-out /messages redirects to login", async ({ page }) => {
  await page.goto("/messages");
  await expect(page).toHaveURL(/\/login/);
});

test.describe("signed in", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("email").fill(process.env.E2E_EMAIL!);
    await page.getByPlaceholder("password").fill(process.env.E2E_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page).toHaveURL("http://localhost:3000/");
  });

  test("inbox renders for signed-in user", async ({ page }) => {
    await page.getByTestId("messages-link").click();
    await expect(page).toHaveURL(/\/messages/);
    // either an inbox list or the empty state must render
    const list = page.getByTestId("inbox-list");
    const empty = page.getByTestId("inbox-empty");
    await expect(list.or(empty)).toBeVisible();
  });

  test("start a conversation from a profile, send, and it persists", async ({ page }) => {
    // E2E account is breeder_jane; message a different seed user.
    await page.goto("/u/sunny_paws_aviary");
    await page.getByTestId("message-button").click();
    await expect(page).toHaveURL(/\/messages\/[0-9a-f-]+/);
    const marker = `E2E dm ${Date.now()}`;
    await page.getByTestId("message-input").fill(marker);
    await page.getByTestId("message-send").click();
    await expect(page.getByText(marker)).toBeVisible();
    // persists across reload
    await page.reload();
    await expect(page.getByText(marker)).toBeVisible();
  });
});
