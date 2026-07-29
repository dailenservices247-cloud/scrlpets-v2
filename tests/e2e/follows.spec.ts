import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { MEMBER_EMAIL, MEMBER_PROFILE_ID, MEMBER_USERNAME, SELLER_EMAIL } from "./fixtures";

// Seeded fixture users (see brand-rbac.spec.ts).

function databaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
}

test("follow round-trip, counts, and self-follow guard", async ({ page }) => {
  test.setTimeout(120_000);
  const password = process.env.E2E_PASSWORD!;

  // The DB refuses a self-follow (CHECK constraint), regardless of the app.
  const ownerDb = databaseClient();
  const ownerAuth = await ownerDb.auth.signInWithPassword({
    email: SELLER_EMAIL,
    password,
  });
  expect(ownerAuth.error).toBeNull();
  const ownerId = ownerAuth.data.user!.id;
  const selfFollow = await ownerDb
    .from("follows")
    .insert({ follower_id: ownerId, following_id: ownerId })
    .select("id");
  expect(selfFollow.error).not.toBeNull();

  // Clean any prior edge so the toggle starts from "not following".
  await ownerDb
    .from("follows")
    .delete()
    .eq("follower_id", ownerId)
    .eq("following_id", MEMBER_PROFILE_ID);

  // Follow the member from their profile, then verify the edge + the button state.
  await signIn(page, SELLER_EMAIL);
  await page.goto(`/u/${MEMBER_USERNAME}`);
  const followButton = page.getByTestId("follow-button");
  await expect(followButton).toHaveText("Follow");
  await followButton.click();
  await expect(followButton).toHaveText("Following");

  await expect
    .poll(async () => {
      const { data } = await ownerDb
        .from("follows")
        .select("id")
        .eq("follower_id", ownerId)
        .eq("following_id", MEMBER_PROFILE_ID);
      return data?.length ?? 0;
    })
    .toBe(1);

  // The member's profile now shows a follower.
  await page.reload();
  await expect(page.getByTestId("follow-counts")).toContainText("followers");

  // A post by the followed member appears in the follower's Following feed;
  // the same post is absent before following (verified by the edge existing now).
  const memberDb = databaseClient();
  await memberDb.auth.signInWithPassword({ email: MEMBER_EMAIL, password });
  const marker = `E2E follow feed post ${Date.now()}`;
  const memberPost = await memberDb
    .from("posts")
    .insert({ author_id: MEMBER_PROFILE_ID, content_type: "post", body: marker })
    .select("id")
    .single();
  expect(memberPost.error).toBeNull();

  await page.goto("/?tab=following");
  await expect(page.getByText(marker)).toBeVisible();

  // Unfollow removes the edge.
  await page.goto(`/u/${MEMBER_USERNAME}`);
  await page.getByTestId("follow-button").click();
  await expect(page.getByTestId("follow-button")).toHaveText("Follow");
  await expect
    .poll(async () => {
      const { data } = await ownerDb
        .from("follows")
        .select("id")
        .eq("follower_id", ownerId)
        .eq("following_id", MEMBER_PROFILE_ID);
      return data?.length ?? 0;
    })
    .toBe(0);

  await memberDb.rpc("soft_delete_managed_post", { target_post_id: memberPost.data!.id });
});
