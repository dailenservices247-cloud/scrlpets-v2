import { test, expect } from "@playwright/test";

test("signed-out user sees the public feed + sign-in CTA (G1-A)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("feed-list")).toBeVisible();
  await expect(page.getByTestId("signin-cta")).toBeVisible();
  await expect(page.getByTestId("bottom-nav")).toBeVisible();
});

test("home header scrolls away while bottom nav stays fixed", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.getByTestId("app-header")).toBeVisible();
  await expect(page.getByTestId("feed-list")).toBeVisible();

  await page.evaluate(() => window.scrollTo(0, 360));
  await page.waitForTimeout(200);

  const headerBox = await page.getByTestId("app-header").boundingBox();
  expect(headerBox).not.toBeNull();
  expect(headerBox!.y + headerBox!.height).toBeLessThan(0);
  await expect(page.getByTestId("bottom-nav")).toBeVisible();
});

test("email sign-in lands on the feed", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
  await expect(page.getByTestId("feed-list")).toBeVisible();
  await expect(page.getByTestId("signin-cta")).toHaveCount(0);
});

test("app shell routes expose menu and shop surfaces", async ({ page }) => {
  await page.goto("/menu");
  await expect(page.getByTestId("app-shell")).toBeVisible();
  await expect(page.getByTestId("menu-profile-card")).toBeVisible();
  await expect(page.getByTestId("bottom-nav")).toBeVisible();

  await page.goto("/shop");
  await expect(page.getByTestId("shop-placeholder")).toBeVisible();
  await expect(page.getByTestId("bottom-nav")).toBeVisible();
});

test("account form exposes accessible browser semantics and recovery", async ({ page }) => {
  await page.goto("/login");
  const email = page.getByLabel("Email address");
  const password = page.getByLabel("Password");
  await expect(email).toHaveAttribute("type", "email");
  await expect(email).toHaveAttribute("autocomplete", "email");
  await expect(password).toHaveAttribute("autocomplete", "current-password");
  await expect(page.getByRole("link", { name: "Forgot your password?" })).toBeVisible();

  await page.getByTestId("auth-mode-signup").click();
  await expect(password).toHaveAttribute("autocomplete", "new-password");
  await expect(password).toHaveAttribute("minlength", "8");
  const ageConfirmation = page.getByTestId("age-confirmation");
  await expect(ageConfirmation).toBeVisible();
  await expect(ageConfirmation).toHaveAttribute("required", "");

  await page.goto("/forgot-password");
  await expect(page.getByRole("heading", { name: "Reset your password" })).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveAttribute("type", "email");
});

test("failed auth callback returns a friendly error without losing the destination", async ({ page }) => {
  await page.goto("/auth/callback?next=%2Flisting%2Fabc");
  await expect(page).toHaveURL(
    "http://localhost:3000/login?error=confirmation_failed&next=%2Flisting%2Fabc",
  );
  await expect(page.getByRole("alert")).toContainText("invalid or has expired");
});

test("guest discovery stays public while participation preserves its return path", async ({ page }) => {
  await page.goto("/u/breeder_jane");
  const messageGate = page.getByTestId("profile-message-signin");
  await expect(messageGate).toBeVisible();
  await expect(messageGate).toHaveAttribute(
    "href",
    "/login?next=%2Fu%2Fbreeder_jane",
  );

  await page.goto("/compose?kind=listing");
  await expect(page).toHaveURL(
    "http://localhost:3000/login?next=%2Fcompose%3Fkind%3Dlisting",
  );

  await page.goto("/shop");
  await expect(page.getByTestId("shop-placeholder")).toContainText(
    "Checkout will always require an account",
  );
});

test("privacy and terms are public", async ({ page }) => {
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Notice" })).toBeVisible();
  await page.goto("/terms");
  await expect(page.getByRole("heading", { name: "Terms" })).toBeVisible();
  await expect(page.getByText("Guest checkout will not be offered.")).toBeVisible();
});

test("optional analytics waits for a guest decision", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.removeItem("scrlpets_analytics_consent"),
  );
  await page.reload();
  // Unconditional: playwright.config injects a dummy PostHog key so this
  // can never pass vacuously when the real key is absent.
  const consent = page.getByTestId("analytics-consent");
  await expect(consent).toBeVisible();
  await consent.getByRole("button", { name: "Decline" }).click();
  await expect(consent).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        localStorage.getItem("scrlpets_analytics_consent"),
      ),
    )
    .toBe("declined");
});
