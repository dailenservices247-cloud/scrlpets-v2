import { test, expect } from "@playwright/test";
import { SELLER_EMAIL, SELLER_USERNAME, signInCached } from "./fixtures";

test.describe("Menu touch targets & Facebook-style profile photo interaction", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(SELLER_EMAIL);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
  });

  test("menu profile card is a full touch target linking directly to profile", async ({ page }) => {
    await page.goto("/menu");
    const profileCard = page.getByTestId("menu-profile-card");
    await expect(profileCard).toBeVisible();

    // Verify it is an anchor linking directly to the user's profile
    await expect(profileCard).toHaveAttribute("href", `/u/${SELLER_USERNAME}`);

    // Click anywhere on the profile card (top left avatar area)
    await profileCard.click({ position: { x: 20, y: 20 } });
    await expect(page).toHaveURL(new RegExp(`/u/${SELLER_USERNAME}`));
    await expect(page.getByTestId("profile-header")).toBeVisible();
  });

  test("clicking profile photo opens Facebook-style options and enlarged viewer", async ({ page }) => {
    // Temporarily set an avatar on the seller profile to test full photo viewer & options
    const { db: sellerDb, userId: sellerId } = await signInCached(SELLER_EMAIL);
    const testAvatar = "https://images.unsplash.com/photo-1543466835-00a7907e9de1?w=500&auto=format&fit=crop&q=80";
    await sellerDb.from("profiles").update({ avatar_url: testAvatar }).eq("id", sellerId);

    try {
      await page.goto(`/u/${SELLER_USERNAME}`);
      await expect(page.getByTestId("profile-header")).toBeVisible();

      // The avatar trigger should be clickable
      const avatarTrigger = page.getByTestId("profile-avatar-trigger");
      await expect(avatarTrigger).toBeVisible();
      await avatarTrigger.click();

      // Facebook-style action sheet opens
      const actionSheet = page.getByTestId("photo-action-sheet");
      await expect(actionSheet).toBeVisible();

      // Verify Facebook-style options
      await expect(actionSheet.getByTestId("action-view-photo")).toBeVisible();
      await expect(actionSheet.getByTestId("action-update-photo")).toBeVisible();

      // Click "See profile picture" to open enlarged full-screen lightbox
      await actionSheet.getByTestId("action-view-photo").click();

      // Lightbox modal opens
      const lightbox = page.getByTestId("photo-lightbox-modal");
      await expect(lightbox).toBeVisible();
      await expect(lightbox.getByTestId("photo-lightbox-img")).toBeVisible();
      await expect(lightbox.getByTestId("photo-lightbox-close")).toBeVisible();

      // Close lightbox
      await lightbox.getByTestId("photo-lightbox-close").click();
      await expect(lightbox).not.toBeVisible();
    } finally {
      // Cleanup avatar_url
      await sellerDb.from("profiles").update({ avatar_url: null }).eq("id", sellerId);
    }
  });

  test("clicking creature avatar opens photo options and enlarged view", async ({ page }) => {
    await page.goto("/c/max-c1");
    await expect(page.getByTestId("creature-header")).toBeVisible();

    const creatureAvatar = page.getByTestId("creature-avatar-trigger");
    await expect(creatureAvatar).toBeVisible();
    await creatureAvatar.click();

    // Action sheet opens
    const actionSheet = page.getByTestId("photo-action-sheet");
    await expect(actionSheet).toBeVisible();
    await expect(actionSheet.getByTestId("action-view-photo")).toBeVisible();

    // Open lightbox
    await actionSheet.getByTestId("action-view-photo").click();
    const lightbox = page.getByTestId("photo-lightbox-modal");
    await expect(lightbox).toBeVisible();
    await expect(lightbox.getByTestId("photo-lightbox-img")).toBeVisible();

    // Press Escape to close
    await page.keyboard.press("Escape");
    await expect(lightbox).not.toBeVisible();
  });
});
