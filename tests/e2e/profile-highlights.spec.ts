import { expect, test, type Page } from "@playwright/test";
import {
  MEMBER_EMAIL,
  SELLER_EMAIL,
  SELLER_PROFILE_ID,
  SELLER_USERNAME,
  THIRD_EMAIL,
  THIRD_PROFILE_ID,
  THIRD_USERNAME,
  signInCached,
} from "./fixtures";

/**
 * Phase D — profile and feed surfaces.
 *
 * No assertion here depends on a NEW i18n string: `messages/en.json` is owned
 * by another lane, so until it lands every new key renders as its own key path.
 * Everything below asserts on test ids, on user-authored text (titles, post
 * bodies), or on database state.
 *
 * Nothing asserts on feed PLACEMENT either — the density caps mean commercial
 * rows are not guaranteed a slot. Rows are looked up by id and asserted on
 * their own page, exactly as compose.spec.ts and content-edit-delete.spec.ts
 * were fixed to do. The one ordering assertion is on the PROFILE timeline,
 * where pin ordering IS the feature under test and no cap applies.
 */

// 1x1 transparent PNG — the smallest thing the uploader will accept.
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
}

function countIn(text: string): number {
  const match = text.match(/\d+/);
  return match ? Number(match[0]) : Number.NaN;
}

/** THIRD follows exactly the seller and nobody else — used by two tests. */
async function giveThirdOneFollow() {
  const { db } = await signInCached(THIRD_EMAIL);
  await db.from("follows").delete().eq("follower_id", THIRD_PROFILE_ID);
  const inserted = await db
    .from("follows")
    .insert({ follower_id: THIRD_PROFILE_ID, following_id: SELLER_PROFILE_ID });
  expect(inserted.error).toBeNull();
}

test("follow counts open the very lists that produced them", async ({ page }) => {
  await giveThirdOneFollow();

  await page.goto(`/u/${SELLER_USERNAME}`);
  const followers = countIn(await page.getByTestId("followers-link").innerText());
  const following = countIn(await page.getByTestId("following-link").innerText());
  expect(followers).toBeGreaterThan(0); // THIRD just followed

  await page.getByTestId("followers-link").click();
  await expect(page).toHaveURL(new RegExp(`/u/${SELLER_USERNAME}/followers`));
  await expect(page.getByTestId("follow-list-row")).toHaveCount(followers);
  await expect(page.getByText(`@${THIRD_USERNAME}`)).toBeVisible();

  await page.goto(`/u/${SELLER_USERNAME}/following`);
  await expect(page.getByTestId("follow-list-row")).toHaveCount(following);
  if (following === 0) {
    await expect(page.getByTestId("follow-list-empty")).toBeVisible();
  }

  // A row is a link to that person's profile.
  await page.goto(`/u/${SELLER_USERNAME}/followers`);
  await page.getByTestId("follow-list-row").first().click();
  await expect(page).toHaveURL(/\/u\/[^/]+$/);
  await expect(page.getByTestId("profile-header")).toBeVisible();
});

test("owner creates a story highlight; anyone who can see the animal can view it", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { db: sellerDb } = await signInCached(SELLER_EMAIL);
  const slug = `e2e-highlights-${Date.now()}`;
  const creature = await sellerDb
    .from("creatures")
    .insert({ owner_id: SELLER_PROFILE_ID, name: "E2E Highlight Animal", slug })
    .select("id")
    .single();
  expect(creature.error).toBeNull();
  const creatureId = creature.data!.id as string;

  // Owner-only creation is an RLS guarantee, not a UI one: a non-owner writing
  // straight at the table is refused.
  const { db: memberDb } = await signInCached(MEMBER_EMAIL);
  const denied = await memberDb
    .from("creature_highlights")
    .insert({
      creature_id: creatureId,
      title: "not mine",
      media_urls: ["https://example.com/x.png"],
    })
    .select("id");
  expect(denied.error).not.toBeNull();

  const title = `E2E highlight ${Date.now()}`;
  await signIn(page, SELLER_EMAIL);
  await page.goto(`/c/${slug}`);
  await expect(page.getByTestId("highlights-empty")).toBeVisible();

  await page.getByTestId("highlight-add").click();
  // Nothing to save yet — the same validation the server will re-run.
  await expect(page.getByTestId("highlight-save")).toBeDisabled();
  await page.getByTestId("highlight-title-input").fill(title);
  await page.getByTestId("media-input").setInputFiles({
    name: "highlight.png",
    mimeType: "image/png",
    buffer: TINY_PNG,
  });
  await expect(page.getByTestId("highlight-media-remove")).toHaveCount(1, {
    timeout: 30_000,
  });
  await expect(page.getByTestId("highlight-save")).toBeEnabled();
  await page.getByTestId("highlight-save").click();

  const card = page.getByTestId("highlight-card").filter({ hasText: title });
  await expect(card).toBeVisible();
  await card.click();
  await expect(page.getByTestId("highlight-viewer")).toBeVisible();
  await expect(page.getByTestId("highlight-viewer-title")).toHaveText(title);
  await expect(page.getByTestId("highlight-media")).toHaveCount(1);

  // A signed-out visitor reads it and gets no create affordance.
  await page.context().clearCookies();
  await page.goto(`/c/${slug}`);
  await expect(page.getByTestId("highlight-card").filter({ hasText: title })).toBeVisible();
  await expect(page.getByTestId("highlight-add")).toHaveCount(0);

  await sellerDb.from("creatures").delete().eq("id", creatureId);
});

test("comments off is enforced by the server, not just hidden in the UI", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { db: sellerDb } = await signInCached(SELLER_EMAIL);
  const stamp = Date.now();
  const post = await sellerDb
    .from("posts")
    .insert({
      author_id: SELLER_PROFILE_ID,
      content_type: "post",
      body: `E2E comment-toggle post ${stamp}`,
      comments_enabled: true,
    })
    .select("id")
    .single();
  expect(post.error).toBeNull();
  const postId = post.data!.id as string;

  await signIn(page, MEMBER_EMAIL);
  await page.goto(`/post/${postId}`);

  // Positive control: while comments are ON, this exact flow works. Without it,
  // "the comment did not appear" would prove nothing about the toggle.
  const allowed = `E2E allowed comment ${stamp}`;
  await page.getByTestId("comment-input").fill(allowed);
  await page.getByTestId("comment-submit").click();
  await expect(page.getByTestId("comment-list").getByText(allowed)).toBeVisible();

  // The author closes comments while the composer is already on the reader's
  // screen — so the click below reaches the server with a stale UI behind it.
  const closed = await sellerDb
    .from("posts")
    .update({ comments_enabled: false })
    .eq("id", postId);
  expect(closed.error).toBeNull();

  const refused = `E2E refused comment ${stamp}`;
  await page.getByTestId("comment-input").fill(refused);
  await page.getByTestId("comment-submit").click();
  await expect(page.getByTestId("comment-list").getByText(refused)).toHaveCount(0);
  await expect
    .poll(
      async () => {
        const { data } = await sellerDb
          .from("comments")
          .select("id")
          .eq("post_id", postId)
          .eq("body", refused);
        return data?.length ?? 0;
      },
      { timeout: 10_000 },
    )
    .toBe(0);

  // And on the next load the reader is told, rather than handed a missing box.
  await page.reload();
  await expect(page.getByTestId("comments-disabled-note")).toBeVisible();
  await expect(page.getByTestId("comment-input")).toHaveCount(0);
  // Comments made before the switch stay readable.
  await expect(page.getByTestId("comment-list").getByText(allowed)).toBeVisible();

  await sellerDb.rpc("soft_delete_managed_post", { target_post_id: postId });
});

test("a pinned post leads the profile and says where it is pinned", async ({ page }) => {
  const { db: sellerDb } = await signInCached(SELLER_EMAIL);
  const stamp = Date.now();
  const pinnedBody = `E2E pinned post ${stamp}`;
  const laterBody = `E2E later post ${stamp}`;

  const pinned = await sellerDb
    .from("posts")
    .insert({ author_id: SELLER_PROFILE_ID, content_type: "post", body: pinnedBody })
    .select("id")
    .single();
  expect(pinned.error).toBeNull();
  const later = await sellerDb
    .from("posts")
    .insert({ author_id: SELLER_PROFILE_ID, content_type: "post", body: laterBody })
    .select("id")
    .single();
  expect(later.error).toBeNull();

  // Pin the OLDER one, so leading the timeline can only be the pin's doing.
  const update = await sellerDb
    .from("posts")
    .update({ pinned_at: new Date().toISOString() })
    .eq("id", pinned.data!.id);
  expect(update.error).toBeNull();

  await page.goto(`/u/${SELLER_USERNAME}`);
  const firstTile = page
    .getByTestId("feed-list")
    .locator('[data-testid^="tile-"]')
    .first();
  await expect(firstTile).toContainText(pinnedBody);
  await expect(firstTile.getByTestId("pinned-chip")).toBeVisible();

  await sellerDb.rpc("soft_delete_managed_post", { target_post_id: pinned.data!.id });
  await sellerDb.rpc("soft_delete_managed_post", { target_post_id: later.data!.id });
});

test("the Following tab admits when it is showing more than your follows", async ({
  page,
}) => {
  // Guests have no graph at all, so their Following tab is always broadened.
  await page.context().clearCookies();
  await page.goto("/?tab=following");
  await expect(page.getByTestId("following-broadened-notice")).toBeVisible();

  // One follow is still under the threshold — and it still says so.
  await giveThirdOneFollow();
  await signIn(page, THIRD_EMAIL);
  await page.goto("/?tab=following");
  await expect(page.getByTestId("following-broadened-notice")).toBeVisible();

  // For You never claims to be your graph, so it never carries the notice.
  await page.goto("/?tab=for_you");
  await expect(page.getByTestId("following-broadened-notice")).toHaveCount(0);
});

test("a group surfaces its own guides, or admits it has none", async ({ page }) => {
  await page.goto("/groups/german-shepherds");
  await expect(page.getByTestId("group-tab-posts")).toHaveAttribute("aria-current", "page");

  await page.getByTestId("group-tab-guides").click();
  await expect(page).toHaveURL(/tab=guides/);
  await expect(page.getByTestId("group-tab-guides")).toHaveAttribute("aria-current", "page");
  // Exactly one of the two: the group's own guides, or an honest empty state.
  await expect(
    page.getByTestId("group-guides-list").or(page.getByTestId("group-guides-empty")),
  ).toBeVisible();
  // The guides tab never falls back to the general library.
  await expect(page.getByTestId("group-posts-empty")).toHaveCount(0);
});
