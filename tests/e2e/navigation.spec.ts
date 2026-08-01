import { test, expect, type Page } from "@playwright/test";
import { SELLER_EMAIL, signInCached } from "./fixtures";

// UI sign-in pattern from compose.spec.ts.
async function signIn(page: Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
}

test.describe("bottom nav", () => {
  test("signed-out sees bottom nav with Market in slot 2", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("bottom-nav")).toBeVisible();
    const market = page.getByTestId("nav-market");
    await expect(market).toBeVisible();
    await expect(market).toHaveAttribute("href", "/market");
    // The two surfaces that have held this slot before it. Discover survives as
    // a route; what it must not be again is a nav slot costing a tap before the
    // thing people came for.
    await expect(page.getByTestId("nav-shop")).toHaveCount(0);
    await expect(page.getByTestId("nav-discover")).toHaveCount(0);
  });
});

test.describe("discover hub", () => {
  test("/discover renders its 4 destination cards", async ({ page }) => {
    await page.goto("/discover");
    await expect(page.getByTestId("discover-card-market")).toHaveAttribute("href", "/market");
    await expect(page.getByTestId("discover-card-groups")).toHaveAttribute("href", "/groups");
    await expect(page.getByTestId("discover-card-guides")).toHaveAttribute("href", "/guides");
    // Unconditional: the only Service-creation path used to be gated behind an
    // operator check, so a groomer with no animals and no brand never saw it.
    await expect(page.getByTestId("discover-card-offer")).toHaveAttribute(
      "href",
      "/market/offer",
    );
  });
});

test.describe("menu", () => {
  test("shows no Feed/Shop/Chat rows and shows a Settings row", async ({ page }) => {
    await page.goto("/menu");
    // Scoped to the page's own content (app-shell), not the bottom nav/side
    // nav siblings, which legitimately still link to / and /messages.
    const body = page.getByTestId("app-shell");
    await expect(body.locator('a[href="/"]')).toHaveCount(0);
    await expect(body.locator('a[href="/shop"]')).toHaveCount(0);
    await expect(body.locator('a[href="/messages"]')).toHaveCount(0);

    const settingsRow = page.getByTestId("menu-settings-row");
    await expect(settingsRow).toBeVisible();
    await expect(settingsRow).toHaveAttribute("href", "/settings");
  });

  test("signed-out menu has no operator section", async ({ page }) => {
    await page.goto("/menu");
    await expect(page.getByTestId("menu-group-your-program")).toHaveCount(0);
  });
});

test.describe("operator-gated surfaces (signed in as a brand owner)", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page, SELLER_EMAIL);
  });

  test("/settings index lists the 5 setting rows", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByTestId("settings-row-profile")).toBeVisible();
    await expect(page.getByTestId("settings-row-account")).toBeVisible();
    await expect(page.getByTestId("settings-row-verification")).toBeVisible();
    await expect(page.getByTestId("settings-row-subscription")).toBeVisible();
    await expect(page.getByTestId("settings-row-referrals")).toBeVisible();
  });

  test("menu shows Your program for an account that owns brands", async ({ page }) => {
    // API setup: confirm the precondition this test depends on — SELLER_EMAIL
    // owns at least one brand — instead of trusting seed data blindly.
    const { db, userId } = await signInCached(SELLER_EMAIL);
    const { data: brands } = await db.from("brands").select("id").eq("owner_id", userId);
    expect(brands?.length ?? 0).toBeGreaterThan(0);

    await page.goto("/menu");
    await expect(page.getByTestId("menu-group-your-program")).toBeVisible();
    await expect(page.getByText("Operator Hub")).toBeVisible();
    await expect(page.getByText("Brand OS")).toBeVisible();
  });
});
