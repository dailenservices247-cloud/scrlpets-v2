import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { MEMBER_EMAIL, MEMBER_PROFILE_ID, MEMBER_USERNAME, SELLER_EMAIL, signInCached } from "./fixtures";

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

test("block severs follows, hides feed, stops DMs; report is append-only", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const password = process.env.E2E_PASSWORD!;

  const { db: ownerDb, userId: __uid_ownerDb } = await signInCached(SELLER_EMAIL);
  const ownerAuth = { data: { user: { id: __uid_ownerDb } }, error: null };
  expect(ownerAuth.error).toBeNull();
  const ownerId = ownerAuth.data.user!.id;
  const { db: memberDb } = await signInCached(MEMBER_EMAIL);

  // Reset any prior state between these two fixture users.
  await ownerDb.rpc("unblock_user", { target_id: MEMBER_PROFILE_ID });
  await ownerDb
    .from("follows")
    .delete()
    .or(`follower_id.eq.${ownerId},following_id.eq.${ownerId}`);

  // The DB refuses a self-block.
  const selfBlock = await ownerDb.rpc("block_user", { target_id: ownerId });
  expect(selfBlock.error?.message).toContain("cannot_block_self");

  // Both directions follow; a member post exists and is visible in the owner's feed.
  await ownerDb
    .from("follows")
    .insert({ follower_id: ownerId, following_id: MEMBER_PROFILE_ID });
  await memberDb
    .from("follows")
    .insert({ follower_id: MEMBER_PROFILE_ID, following_id: ownerId });
  const marker = `E2E block feed post ${Date.now()}`;
  const memberPost = await memberDb
    .from("posts")
    .insert({ author_id: MEMBER_PROFILE_ID, content_type: "post", body: marker })
    .select("id")
    .single();
  expect(memberPost.error).toBeNull();

  await signIn(page, SELLER_EMAIL);
  await page.goto("/?tab=for_you");
  await expect(page.getByText(marker)).toBeVisible();

  // Block from the member's profile via the UI.
  await page.goto(`/u/${MEMBER_USERNAME}`);
  await page.getByTestId("block-toggle").click();
  await expect(page.getByTestId("profile-blocked-note")).toBeVisible();

  // Both follow edges are gone.
  await expect
    .poll(async () => {
      const { data } = await ownerDb
        .from("follows")
        .select("id")
        .or(
          `and(follower_id.eq.${ownerId},following_id.eq.${MEMBER_PROFILE_ID}),and(follower_id.eq.${MEMBER_PROFILE_ID},following_id.eq.${ownerId})`,
        );
      return data?.length ?? 0;
    })
    .toBe(0);

  // The member's post is now hidden from the owner's feed.
  await page.goto("/?tab=for_you");
  await expect(page.getByText(marker)).toHaveCount(0);

  // DMs between the pair are blocked at the DB. Create/find the conversation, then
  // the blocked send fails.
  const [a, b] = [ownerId, MEMBER_PROFILE_ID].sort();
  let convId: string;
  const existing = await ownerDb
    .from("conversations")
    .select("id")
    .eq("user_a", a)
    .eq("user_b", b)
    .maybeSingle();
  if (existing.data) {
    convId = existing.data.id;
  } else {
    const created = await ownerDb
      .from("conversations")
      .insert({ user_a: a, user_b: b })
      .select("id")
      .single();
    convId = created.data!.id;
  }
  const blockedSend = await memberDb
    .from("messages")
    .insert({ conversation_id: convId, sender_id: MEMBER_PROFILE_ID, body: "E2E blocked dm" })
    .select("id");
  expect(blockedSend.error).not.toBeNull();

  // Unblock restores messaging.
  await ownerDb.rpc("unblock_user", { target_id: MEMBER_PROFILE_ID });
  const allowedSend = await memberDb
    .from("messages")
    .insert({ conversation_id: convId, sender_id: MEMBER_PROFILE_ID, body: "E2E allowed dm" })
    .select("id")
    .single();
  expect(allowedSend.error).toBeNull();

  // Report is append-only: reporter inserts + reads own; a non-reporter cannot
  // read it; an invalid reason is rejected.
  const report = await memberDb
    .from("content_reports")
    .insert({
      reporter_id: MEMBER_PROFILE_ID,
      target_kind: "profile",
      target_id: ownerId,
      reason: "spam",
    })
    .select("id")
    .single();
  expect(report.error).toBeNull();
  const ownReports = await memberDb
    .from("content_reports")
    .select("id")
    .eq("id", report.data!.id);
  expect(ownReports.data?.length).toBe(1);
  const otherReports = await ownerDb
    .from("content_reports")
    .select("id")
    .eq("id", report.data!.id);
  expect(otherReports.data).toEqual([]);
  const invalidReason = await memberDb
    .from("content_reports")
    .insert({
      reporter_id: MEMBER_PROFILE_ID,
      target_kind: "profile",
      target_id: ownerId,
      reason: "not_a_reason",
    })
    .select("id");
  expect(invalidReason.error).not.toBeNull();

  // Cleanup.
  await memberDb.from("messages").delete().eq("conversation_id", convId);
  await memberDb.rpc("soft_delete_managed_post", { target_post_id: memberPost.data!.id });
  await memberDb.from("content_reports").delete().eq("id", report.data!.id);
  await ownerDb
    .from("follows")
    .delete()
    .or(`follower_id.eq.${ownerId},following_id.eq.${ownerId}`);
});
