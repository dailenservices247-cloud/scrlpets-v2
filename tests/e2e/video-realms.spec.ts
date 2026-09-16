import { expect, test, type Locator, type Page } from "@playwright/test";
import { SELLER_EMAIL, signInCached } from "./fixtures";

// Realm/tile rendering keys off the URL extension, so no real MP4 is needed.
// Note what this URL actually does under the suite's production build: it is
// not in the CSP `media-src` allow-list, so the browser refuses it while the
// HTML is still parsing. Every run therefore exercises the FAILED-load path,
// and the assertions below have to be able to tell that apart from a good one.
const FAKE_MP4 = "https://example.com/e2e-clip.mp4";

/**
 * A18: the presence of a <video> ELEMENT proves nothing. A video whose source
 * the browser refused renders the identical element — same testid, same box,
 * just black — so `video OR fallback` matched the black box and passed whether
 * media loaded or not. Accept the video only once the browser actually holds
 * the media (metadata parsed AND a real intrinsic width); otherwise the honest
 * A18 fallback must be on screen. Neither one means the member is looking at a
 * black rectangle, which is the defect this guards.
 */
async function expectPlayableOrHonestFallback(scope: Locator | Page, videoTestId: string) {
  await expect
    .poll(
      async () => {
        if (await scope.getByTestId("video-unplayable").isVisible()) return "honest fallback";
        const video = scope.getByTestId(videoTestId);
        if (!(await video.isVisible())) return "nothing rendered";
        return video.evaluate((el) => {
          const v = el as HTMLVideoElement;
          return v.readyState >= HTMLMediaElement.HAVE_METADATA && v.videoWidth > 0
            ? "playable video"
            : "black box";
        });
      },
      {
        timeout: 20_000,
        message: `neither a playable ${videoTestId} nor the A18 unplayable fallback`,
      },
    )
    .toMatch(/^(playable video|honest fallback)$/);
}

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  // Relative, resolved against baseURL: a hardcoded port makes this file
  // unrunnable whenever another worktree already holds 3000.
  await expect(page).toHaveURL("/", { timeout: 20_000 });
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
  await expectPlayableOrHonestFallback(reelTile, "tile-media-video");
  // §4 immersive: the mute toggle rides ON the video. Conditional on the video
  // actually rendering, because FAKE_MP4 may legitimately trip the A18
  // unplayable fallback — and a fallback has no video to mute. Asserting it
  // unconditionally would fail for the one reason that is not a defect.
  if ((await reelTile.getByTestId("tile-media-video").count()) > 0) {
    await expect(reelTile.getByTestId("tile-mute-toggle")).toBeVisible();
  }

  // A4/A19: tapping the reel VIDEO lands in the swipe realm (no CTA button).
  await reelTile.getByTestId("reel-open").click();
  await expect(page).toHaveURL(new RegExp(`/watch/reel/${reel!.id}`), {
    timeout: 20_000,
  });
  await expect(page.getByTestId("reel-realm")).toBeVisible();
  const slide = page.locator(`[data-reel-id="${reel!.id}"]`);
  await expect(slide).toBeVisible();
  await expectPlayableOrHonestFallback(slide, "reel-video");
  await expect(page.getByTestId("reel-mute-toggle")).toBeVisible();
  await expect(page.getByTestId("reel-back")).toBeVisible();
  // A20: the FB/TikTok right-side action rail on the active slide.
  await expect(slide.getByTestId("reel-rail")).toBeVisible();

  // A5: the long-video destination renders a real player with controls.
  // Deliberately NOT load-gated like the two surfaces above: this player carries
  // native `controls`, so a refused source still shows the member a player and
  // the browser's own broken-media chrome rather than a featureless black box.
  // It has no A18 fallback to demand and no onError to miss. If it is ever given
  // one, gate it here too.
  await page.goto(`/watch/${longVideo!.id}`);
  await expect(page.getByTestId("destination-long_video")).toBeVisible();
  await expect(page.getByTestId("player-video")).toBeVisible();
  await expect(page.getByTestId("player-video")).toHaveAttribute("controls", "");

  // Cleanup.
  await db.rpc("soft_delete_managed_post", { target_post_id: reel!.id });
  await db.rpc("soft_delete_managed_post", { target_post_id: longVideo!.id });
});
