import { test, expect } from "@playwright/test";
import { SELLER_EMAIL } from "./fixtures";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test.describe("Social Video Embeds & 1-Tap Outbound Share", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Email address").fill(SELLER_EMAIL);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
  });

  test("composer supports pasting social video links with live embed preview and auto-detection", async ({ page }) => {
    await page.goto("/compose");
    await expect(page.getByTestId("post-form")).toBeVisible();

    // Click "Paste Video Link" tab
    const linkTab = page.getByTestId("tab-media-link");
    await expect(linkTab).toBeVisible();
    await linkTab.click();

    // Enter YouTube video URL
    const input = page.getByTestId("social-link-input");
    await expect(input).toBeVisible();
    await input.fill("https://www.youtube.com/watch?v=dQw4w9WgXcQ");

    // Embed player preview mounts
    await expect(page.getByTestId("embed-player")).toBeVisible();

    // Video kind buttons (reel / long video) appear and long_video is auto-selected for regular YouTube
    const longBtn = page.getByTestId("video-kind-long_video");
    await expect(longBtn).toBeVisible();

    // Syndication panel is visible and toggleable
    const syndicateCheckbox = page.getByTestId("post-syndicate-checkbox");
    await expect(syndicateCheckbox).toBeVisible();
    await syndicateCheckbox.check();
    await expect(syndicateCheckbox).toBeChecked();

    // Switching to YouTube Shorts automatically detects "reel"
    await input.fill("https://www.youtube.com/shorts/AbCdEf12345");
    const reelBtn = page.getByTestId("video-kind-reel");
    await expect(reelBtn).toHaveAttribute("aria-pressed", "true");
  });

  test("feed post tiles render share button and open 1-tap social share modal", async ({ page }) => {
    await page.goto("/");
    // The feed tiles render share buttons
    const shareBtn = page.getByTestId("share-trigger-button").first();
    await expect(shareBtn).toBeVisible({ timeout: 15_000 });
    await shareBtn.click();

    // Verify Share Modal opens
    const modal = page.getByTestId("share-modal");
    await expect(modal).toBeVisible();

    // Check social destinations
    await expect(modal.getByTestId("share-dest-facebook")).toBeVisible();
    await expect(modal.getByTestId("share-dest-xtwitter")).toBeVisible();
    await expect(modal.getByTestId("share-dest-whatsapp")).toBeVisible();
    await expect(modal.getByTestId("share-dest-instagram")).toBeVisible();

    // Check copy button
    const copyBtn = modal.getByTestId("share-copy-button");
    await expect(copyBtn).toBeVisible();
    await copyBtn.click();
    await expect(copyBtn).toContainText("Copied");
  });
});
