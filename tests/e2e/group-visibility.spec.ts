import { createClient } from "@supabase/supabase-js";
import { expect, test } from "@playwright/test";
import { SELLER_EMAIL, SELLER_USERNAME, signInCached } from "./fixtures";

/**
 * Groups are PUBLIC — breed communities whose whole value is discovery — so a
 * post made into one appears in every visitor's home feed. That is the intended
 * behaviour and these tests assert it, not against it.
 *
 * What was wrong was that nobody was told. `unified_feed` did not carry
 * group_id, so the tile could not say where the post came from, and the author
 * is redirected to the group timeline after posting and never saw it land
 * anywhere else. Both halves are asserted here: the view now carries the group,
 * and both composers say so before the post exists.
 *
 * NOTHING here asserts feed PLACEMENT. The home feed applies commercial density
 * caps and a 50/200-row limit, so no individual row is guaranteed a slot. The
 * chip is asserted on the author's profile feed, which is an uncapped read of
 * the same view through the same tile, and the world-readability claim is
 * asserted straight against the view as a signed-out client.
 */

const GROUP_SLUG = "german-shepherds";

/** A guest. No sign-in, no session — the audience the leak was invisible to. */
function anonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * Join only if not already joined, and report which — the fixture accounts are
 * shared, so teardown must put membership back exactly as it found it rather
 * than deleting a row another spec depends on.
 */
async function ensureMember(
  db: ReturnType<typeof anonClient>,
  groupId: string,
  userId: string,
): Promise<{ joinedByThisTest: boolean }> {
  const existing = await db
    .from("group_memberships")
    .select("profile_id")
    .eq("group_id", groupId)
    .eq("profile_id", userId)
    .maybeSingle();
  if (existing.data) return { joinedByThisTest: false };
  const joined = await db
    .from("group_memberships")
    .insert({ group_id: groupId, profile_id: userId });
  expect(joined.error, "fixture could not join the group").toBeNull();
  return { joinedByThisTest: true };
}

/**
 * Posts have no DELETE policy and `deleted_at` is not client-writable either —
 * removal on this platform is `soft_delete_managed_post`, the same definer
 * global-setup.ts uses to sweep leftover markers. Asserted on the way out: the
 * definer returns whether it actually removed anything, and the row must then
 * be gone from `unified_feed`, which is the surface these tests are about.
 */
async function teardown(
  db: ReturnType<typeof anonClient>,
  postId: string,
  groupId: string,
  userId: string,
  membership: { joinedByThisTest: boolean },
) {
  const removed = await db.rpc("soft_delete_managed_post", { target_post_id: postId });
  expect(removed.error).toBeNull();
  expect(removed.data, "the test post was not removed").toBe(true);
  if (membership.joinedByThisTest) {
    await db
      .from("group_memberships")
      .delete()
      .eq("group_id", groupId)
      .eq("profile_id", userId);
  }
  const gone = await db.from("unified_feed").select("id").eq("id", postId).maybeSingle();
  expect(gone.data, "test post survived teardown").toBeNull();
}

test("a group post is world-readable AND the feed can say which group it is in", async () => {
  test.setTimeout(120_000);
  const { db, userId } = await signInCached(SELLER_EMAIL);

  const group = await db
    .from("groups")
    .select("id,name,slug")
    .eq("slug", GROUP_SLUG)
    .single();
  expect(group.error, "seeded breed group is missing").toBeNull();

  const membership = await ensureMember(db, group.data!.id, userId);
  const body = `E2E group visibility ${Date.now()}`;
  const created = await db
    .from("posts")
    .insert({
      author_id: userId,
      content_type: "post",
      body,
      group_id: group.data!.id,
    })
    .select("id")
    .single();
  expect(created.error, "member could not post into the group").toBeNull();
  const postId = created.data!.id;

  try {
    // THE BEHAVIOUR, stated plainly: a signed-out stranger can read it.
    const guest = anonClient();
    const seen = await guest
      .from("unified_feed")
      .select("id,kind,group_id,group_slug,group_name")
      .eq("id", postId)
      .maybeSingle();
    expect(seen.error).toBeNull();
    expect(
      seen.data,
      "group posts are public by design — a guest must be able to read this row",
    ).not.toBeNull();

    // THE FIX: the row now carries enough to label and link the chip. Before
    // 20260801130000 all three of these were absent from the view entirely,
    // which is why the post rendered as an ordinary unlabelled post.
    expect(seen.data!.group_id).toBe(group.data!.id);
    expect(seen.data!.group_slug).toBe(GROUP_SLUG);
    expect(seen.data!.group_name).toBe(group.data!.name);

    // The other two branches of the UNION carry the columns as nulls rather
    // than dropping out of the view — a listing must still be a feed row.
    const listing = await guest
      .from("unified_feed")
      .select("id,kind,group_id")
      .eq("kind", "listing")
      .limit(1)
      .maybeSingle();
    expect(listing.error, "the listing branch of unified_feed broke").toBeNull();
    if (listing.data) expect(listing.data.group_id).toBeNull();
  } finally {
    await teardown(db, postId, group.data!.id, userId, membership);
  }
});

test("the group chip is rendered, and both composers disclose before posting", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const { db, userId } = await signInCached(SELLER_EMAIL);

  const group = await db
    .from("groups")
    .select("id,name,slug")
    .eq("slug", GROUP_SLUG)
    .single();
  expect(group.error).toBeNull();
  const membership = await ensureMember(db, group.data!.id, userId);

  const body = `E2E group chip ${Date.now()}`;
  const created = await db
    .from("posts")
    .insert({ author_id: userId, content_type: "post", body, group_id: group.data!.id })
    .select("id")
    .single();
  expect(created.error).toBeNull();
  const postId = created.data!.id;

  try {
    // The chip, on an uncapped surface. Same FeedCardShell the home feed uses,
    // so this proves the shell renders it without claiming a home-feed slot.
    await page.goto(`/u/${SELLER_USERNAME}`);
    // Scoped to THIS post's tile, so a chip on somebody else's group post
    // cannot make the assertion pass.
    const tile = page.locator('[data-testid="tile-post"]', { hasText: body });
    await expect(tile).toBeVisible({ timeout: 20_000 });
    const chip = tile.getByTestId("group-chip");
    await expect(chip).toBeVisible();
    await expect(chip).toHaveAttribute("href", `/groups/${GROUP_SLUG}`);
    await expect(chip).toHaveText(group.data!.name);

    await page.context().clearCookies();
    await page.goto("/login");
    await page.getByLabel("Email address").fill(SELLER_EMAIL);
    await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
    await page.getByTestId("auth-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

    // Disclosure 1: the in-group composer.
    await page.goto(`/groups/${GROUP_SLUG}`);
    await expect(page.getByTestId("group-post-form")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("group-public-notice")).toBeVisible();

    // Disclosure 2: the main composer, next to the group picker and BEFORE any
    // choice is made — this is the screen where the author decides.
    await page.goto("/compose");
    await expect(page.getByTestId("post-group-select")).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("group-public-notice")).toBeVisible();
  } finally {
    await teardown(db, postId, group.data!.id, userId, membership);
  }
});
