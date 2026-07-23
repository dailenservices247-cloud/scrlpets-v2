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

test("comment, reply, edit, soft-delete tombstone, permissions, block-hide", async ({
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
  const memberDb = databaseClient();
  await memberDb.auth.signInWithPassword({ email: MEMBER_EMAIL, password });

  // Clean any block between the fixtures so hidden-content assertions are clean.
  await ownerDb.rpc("unblock_user", { target_id: MEMBER_PROFILE_ID });

  const marker = `E2E comments post ${Date.now()}`;
  const post = await ownerDb
    .from("posts")
    .insert({ author_id: ownerId, content_type: "post", body: marker })
    .select("id")
    .single();
  const postId = post.data!.id;

  // Owner comments; a reply is added; owner edits the root.
  await signIn(page, process.env.E2E_EMAIL!);
  await page.goto(`/post/${postId}`);
  await page.getByTestId("comment-input").fill("E2E first comment");
  await page.getByTestId("comment-submit").click();
  await expect(page.getByTestId("comment-body")).toContainText("E2E first comment");

  const rootId = await ownerDb
    .from("comments")
    .select("id")
    .eq("post_id", postId)
    .is("parent_id", null)
    .single();
  // The member replies via the DB (a second authed user).
  await memberDb.from("comments").insert({
    post_id: postId,
    author_id: MEMBER_PROFILE_ID,
    parent_id: rootId.data!.id,
    body: "E2E member reply",
  });

  await page.reload();
  await expect(page.getByText("E2E member reply")).toBeVisible();

  // Owner edits the root; the edited marker shows.
  await page.getByTestId("comment-edit").first().click();
  await page.getByRole("textbox", { name: "Edit comment" }).fill("E2E first comment edited");
  await page.getByTestId("comment-edit-save").click();
  await expect(page.getByTestId("comment-body").first()).toContainText("edited");

  // A non-author cannot edit/delete another's comment (RLS).
  const memberEditsOwnerRoot = await memberDb
    .from("comments")
    .update({ body: "E2E hijack" }, { count: "exact" })
    .eq("id", rootId.data!.id);
  expect(memberEditsOwnerRoot.count).toBe(0);

  // Soft-deleting the root keeps it as a tombstone because it has a reply.
  await page.getByTestId("comment-delete").first().click();
  await expect(page.getByTestId("comment-deleted")).toBeVisible();
  await expect(page.getByText("E2E member reply")).toBeVisible();
  // The deleted body is gone from the DB (blanked), not just hidden.
  const deletedRow = await ownerDb
    .from("comments")
    .select("body, deleted_at")
    .eq("id", rootId.data!.id)
    .single();
  expect(deletedRow.data!.body).toBe("");
  expect(deletedRow.data!.deleted_at).not.toBeNull();

  // Comments are reportable; a report row lands with kind 'comment'.
  const report = await memberDb
    .from("content_reports")
    .insert({
      reporter_id: MEMBER_PROFILE_ID,
      target_kind: "comment",
      target_id: rootId.data!.id,
      reason: "spam",
    })
    .select("id")
    .single();
  expect(report.error).toBeNull();

  // Block-hiding: after the owner blocks the member, the member's reply is hidden.
  await ownerDb.rpc("block_user", { target_id: MEMBER_PROFILE_ID });
  await page.reload();
  await expect(page.getByText("E2E member reply")).toHaveCount(0);

  // Cleanup.
  await ownerDb.rpc("unblock_user", { target_id: MEMBER_PROFILE_ID });
  await memberDb.from("content_reports").delete().eq("id", report.data!.id);
  await ownerDb.from("comments").delete().eq("post_id", postId);
  await ownerDb.rpc("soft_delete_managed_post", { target_post_id: postId });
});

// F5: commenting happens IN the feed (A17) and comments take reactions (A16).
test("inline feed commenting and comment reactions", async ({ page }) => {
  test.setTimeout(120_000);
  const password = process.env.E2E_PASSWORD!;
  const ownerDb = databaseClient();
  const ownerAuth = await ownerDb.auth.signInWithPassword({
    email: process.env.E2E_EMAIL!,
    password,
  });
  const ownerId = ownerAuth.data.user!.id;
  const marker = `E2E inline thread post ${Date.now()}`;
  const post = await ownerDb
    .from("posts")
    .insert({ author_id: ownerId, content_type: "post", body: marker })
    .select("id")
    .single();
  const postId = post.data!.id;

  await signIn(page, process.env.E2E_EMAIL!);
  const card = page.getByTestId("tile-post").filter({ hasText: marker });
  await expect(card).toBeVisible({ timeout: 15_000 });

  // Expanding comments stays ON the feed — no navigation.
  await card.getByTestId("post-comments-link").click();
  await expect(page).toHaveURL("http://localhost:3000/");
  await expect(card.getByTestId("inline-comments")).toBeVisible();

  await card.getByTestId("comment-input").fill("E2E inline comment");
  await card.getByTestId("comment-submit").click();
  await expect(card.getByTestId("comment-body")).toContainText("E2E inline comment");

  // React to the comment from the inline thread.
  await card.getByTestId("comment-react").click();
  await page.getByTestId("comment-reaction-love").click();
  await expect(card.getByTestId("comment-react")).toHaveAttribute(
    "data-reaction",
    "love",
  );
  await expect(card.getByTestId("comment-reaction-total")).toContainText("1");

  // The reaction row is real and constrained to one per user.
  const { data: rows } = await ownerDb
    .from("comment_reactions")
    .select("reaction_type")
    .eq("user_id", ownerId);
  expect(rows?.length).toBe(1);
  expect(rows?.[0]?.reaction_type).toBe("love");

  // Cleanup.
  await ownerDb.from("comments").delete().eq("post_id", postId);
  await ownerDb.rpc("soft_delete_managed_post", { target_post_id: postId });
});
