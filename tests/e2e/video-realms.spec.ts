import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { SELLER_EMAIL, signInCached } from "./fixtures";

// A tiny real MP4 URL is unnecessary — realm/tile rendering keys off the URL
// extension; playback itself is browser-policy territory, not app logic.
const FAKE_MP4 = "https://example.com/e2e-clip.mp4";

function databaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
}

// F4: feed video tiles render <video> (A3 autoplay wiring), the reel
// destination is the swipe realm (A4), and the long-video destination carries
// a real player (A5).
test("video tiles, the reel realm, and the long-video player", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { db: db, userId: __uid_db } = await signInCached(SELLER_EMAIL);
  const auth = { data: { user: { id: __uid_db } }, error: null };
  const userId = auth.data.user!.id;

  const reelMarker = `E2E realm reel ${Date.now()}`;
  const videoMarker = `E2E realm long video ${Date.now()}`;
  const { data: reel } = await db
    .from("posts")
    .insert({
      author_id: userId,
      content_type: "reel",
      body: reelMarker,
      media_url: FAKE_MP4,
    })
    .select("id")
    .single();
  const { data: longVideo } = await db
    .from("posts")
    .insert({
      author_id: userId,
      content_type: "long_video",
      body: videoMarker,
      media_url: FAKE_MP4,
    })
    .select("id")
    .single();

  await signIn(page);

  // A3: the reel's FEED tile renders an autoplay-wired <video>, not an <img>.
  const reelTile = page.getByTestId("tile-reel").filter({ hasText: reelMarker });
  await expect(reelTile).toBeVisible({ timeout: 15_000 });
  // The fake URL may legitimately trip the A18 unplayable fallback — either
  // render proves the video pipeline (element first, honest fallback after).
  await expect(
    reelTile.locator('[data-testid="tile-media-video"], [data-testid="video-unplayable"]'),
  ).toBeVisible();

  // A4/A19: tapping the reel VIDEO lands in the swipe realm (no CTA button).
  await reelTile.getByTestId("reel-open").click();
  await expect(page).toHaveURL(new RegExp(`/watch/reel/${reel!.id}`), {
    timeout: 20_000,
  });
  await expect(page.getByTestId("reel-realm")).toBeVisible();
  const slide = page.locator(`[data-reel-id="${reel!.id}"]`);
  await expect(slide).toBeVisible();
  await expect(
    slide.locator('[data-testid="reel-video"], [data-testid="video-unplayable"]'),
  ).toBeVisible();
  await expect(page.getByTestId("reel-mute-toggle")).toBeVisible();
  await expect(page.getByTestId("reel-back")).toBeVisible();
  // A20: the FB/TikTok right-side action rail on the active slide.
  await expect(slide.getByTestId("reel-rail")).toBeVisible();

  // A5: the long-video destination renders a real player with controls.
  await page.goto(`/watch/${longVideo!.id}`);
  await expect(page.getByTestId("destination-long_video")).toBeVisible();
  await expect(page.getByTestId("player-video")).toBeVisible();
  await expect(page.getByTestId("player-video")).toHaveAttribute("controls", "");

  // Cleanup.
  await db.rpc("soft_delete_managed_post", { target_post_id: reel!.id });
  await db.rpc("soft_delete_managed_post", { target_post_id: longVideo!.id });
});
