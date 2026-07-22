import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const MEMBER_EMAIL = "scrlpets-rbac-e2e@scrlpets.com";
const MEMBER_PROFILE_ID = "8f62eba7-aa0a-4603-8134-5e37ca74ab23";

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

test("react (one per user, changeable) and save (private) on a post", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const password = process.env.E2E_PASSWORD!;

  const ownerDb = databaseClient();
  const ownerAuth = await ownerDb.auth.signInWithPassword({
    email: process.env.E2E_EMAIL!,
    password,
  });
  const ownerId = ownerAuth.data.user!.id;

  // A member owns a post the owner will react to / save.
  const memberDb = databaseClient();
  await memberDb.auth.signInWithPassword({ email: MEMBER_EMAIL, password });
  const marker = `E2E reaction post ${Date.now()}`;
  const post = await memberDb
    .from("posts")
    .insert({ author_id: MEMBER_PROFILE_ID, content_type: "post", body: marker })
    .select("id")
    .single();
  expect(post.error).toBeNull();
  const postId = post.data!.id;

  await signIn(page, process.env.E2E_EMAIL!);
  await page.goto(`/post/${postId}`);

  // React "like", then switch to "love" — still exactly one reaction row.
  // The picker pops from the single React trigger (punch list A7).
  await page.getByTestId("reaction-trigger").click();
  await page.getByTestId("reaction-like").click();
  await expect(page.getByTestId("reaction-trigger")).toHaveAttribute("data-reaction", "like");
  await page.getByTestId("reaction-trigger").click();
  await expect(page.getByTestId("reaction-like")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("reaction-love").click();
  await expect(page.getByTestId("reaction-trigger")).toHaveAttribute("data-reaction", "love");
  await page.getByTestId("reaction-trigger").click();
  await expect(page.getByTestId("reaction-love")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("reaction-like")).toHaveAttribute("aria-pressed", "false");

  await expect
    .poll(async () => {
      const { data } = await ownerDb
        .from("post_reactions")
        .select("reaction_type")
        .eq("post_id", postId)
        .eq("user_id", ownerId);
      return data?.map((r) => r.reaction_type) ?? [];
    })
    .toEqual(["love"]);

  // Toggling the active reaction off clears it (picker already open from above).
  await page.getByTestId("reaction-love").click();
  await expect(page.getByTestId("reaction-trigger")).toHaveAttribute("data-reaction", "none");
  await expect
    .poll(async () => {
      const { count } = await ownerDb
        .from("post_reactions")
        .select("id", { count: "exact", head: true })
        .eq("post_id", postId)
        .eq("user_id", ownerId);
      return count ?? 0;
    })
    .toBe(0);

  // Save the post; it appears in /saved and is private to the owner.
  await page.getByTestId("save-button").click();
  await expect(page.getByTestId("save-button")).toHaveAttribute("aria-pressed", "true");
  await page.goto("/saved");
  await expect(page.getByTestId("saved-list")).toContainText(marker);

  // The member cannot read the owner's saved rows (owner-only RLS).
  const memberSeesOwnerSaves = await memberDb
    .from("saved_posts")
    .select("id")
    .eq("user_id", ownerId);
  expect(memberSeesOwnerSaves.data).toEqual([]);

  // Unsave via the destination toggle.
  await page.goto(`/post/${postId}`);
  await page.getByTestId("save-button").click();
  await expect(page.getByTestId("save-button")).toHaveAttribute("aria-pressed", "false");

  // Cleanup: reactions/saves cascade on post delete; remove the member post.
  await ownerDb.from("post_reactions").delete().eq("post_id", postId);
  await ownerDb.from("saved_posts").delete().eq("post_id", postId);
  await memberDb.rpc("soft_delete_managed_post", { target_post_id: postId });
});
