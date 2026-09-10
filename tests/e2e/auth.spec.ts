import { test, expect } from "@playwright/test";
import { SELLER_EMAIL } from "./fixtures";

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
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
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
  // Phase 4 replaced the placeholder with the real product surface; it renders
  // either the grid or its empty state, never nothing.
  const shopRendered =
    (await page.getByTestId("shop-grid").count()) +
    (await page.getByTestId("shop-empty").count());
  expect(shopRendered).toBeGreaterThan(0);
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

  // Reworded: someone who joined with Google has no password to "reset", and
  // reading it that way is exactly how you end up stuck with no way in.
  await page.goto("/forgot-password");
  await expect(
    page.getByRole("heading", { name: "Set or reset your password" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email address")).toHaveAttribute("type", "email");
});

test("failed auth callback returns a friendly error without losing the destination", async ({ page }) => {
  await page.goto("/auth/callback?next=%2Flisting%2Fabc");
  await expect(page).toHaveURL(
    "http://localhost:3000/login?error=confirmation_failed&next=%2Flisting%2Fabc",
  );
  // Scoped: Next's route announcer is also role="alert" after client nav.
  await expect(
    page.getByRole("alert").filter({ hasText: "invalid or has expired" }),
  ).toBeVisible();
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

  // The shop stays browsable to guests, and says plainly that checkout is off
  // rather than showing a control that cannot work.
  await page.goto("/shop");
  await expect(page.getByTestId("shop-checkout-notice")).toContainText(
    "Checkout is not switched on yet",
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

test("a referral link lands on the signup tab with the invite preserved", async ({ page }) => {
  await page.goto("/signup?ref=AB12CD34");
  // /signup preserves the code across its redirect, and the form honors both
  // params instead of silently opening the sign-in tab without the invite.
  await expect(page).toHaveURL(/\/login\?mode=signup&ref=AB12CD34/);
  await expect(page.getByTestId("auth-mode-signup")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("the login page offers a passwordless code, sign-in only", async ({ page }) => {
  await page.goto("/login");
  const codeButton = page.getByTestId("auth-email-code");
  await expect(codeButton).toBeVisible();
  // Nothing to send a code to yet, so the control says so instead of failing
  // after the click.
  await expect(codeButton).toBeDisabled();
  await page.getByLabel("Email address").fill("someone@example.com");
  await expect(codeButton).toBeEnabled();

  // Signing UP still goes through the server action, where the 18+ gate and the
  // password rule are decided. A code box that could create accounts would walk
  // straight past both.
  await page.getByTestId("auth-mode-signup").click();
  await expect(codeButton).toHaveCount(0);
});

test("a code request never reveals whether the account exists", async ({ page }) => {
  await page.goto("/login");
  // Certainly not an account. `shouldCreateUser: false` makes Supabase refuse
  // it — and refusing OUT LOUD would turn this box into a membership oracle,
  // so the screen has to be the same one a real account gets. No email is sent
  // on this path, which is also why it is safe to run every suite.
  await page
    .getByLabel("Email address")
    .fill(`no-such-${Date.now()}@example.com`);
  await page.getByTestId("auth-email-code").click();

  await expect(page.getByTestId("auth-code-sent")).toBeVisible();
  await expect(page.getByTestId("auth-error")).toHaveCount(0);

  const code = page.getByLabel("6-digit code");
  // What makes the platform offer the code from the notification shade.
  await expect(code).toHaveAttribute("autocomplete", "one-time-code");
  await expect(code).toHaveAttribute("inputmode", "numeric");

  // A wrong code is a CODE problem. The shared error mapper turns anything
  // containing "otp" into `link_expired`, whose copy talks about a link that
  // was never clicked.
  await code.fill("000000");
  await page.getByTestId("auth-code-submit").click();
  await expect(page.getByTestId("auth-error")).toHaveAttribute(
    "data-error",
    "code_invalid",
  );
});
