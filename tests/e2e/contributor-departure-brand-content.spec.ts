import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

// Reuses the seeded RBAC fixture users (see brand-rbac.spec.ts).
const MEMBER_EMAIL = "scrlpets-rbac-e2e@scrlpets.com";
const MEMBER_PROFILE_ID = "8f62eba7-aa0a-4603-8134-5e37ca74ab23";
const MEMBER_USERNAME = "scrlpets-rbac-e2e_8f62";

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
  // Tolerant window: a cold dev server compiles the destination route on the
  // first sign-in; a genuine auth failure still stays on /login past this.
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
}

// THE regression test for Slice B: a brand owner retains edit+delete control of
// content a contributor published under the brand — even after that contributor
// leaves — and every manager mutation of someone else's content is audited.
test("brand owner controls a departed contributor's brand content, audited", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const password = process.env.E2E_PASSWORD!;
  const brandName = `E2E Departure Brand ${Date.now()}`;
  const memberBrandPostBody = `E2E departed member brand post ${Date.now()}`;
  const memberPersonalPostBody = `E2E departed member personal post ${Date.now()}`;

  // Owner creates a brand and adds MEMBER as a contributor.
  await signIn(page, process.env.E2E_EMAIL!);
  await page.goto("/brands/new");
  await page.getByTestId("brand-name").fill(brandName);
  await page.getByTestId("brand-create-submit").click();
  await expect(page).toHaveURL(/\/compose\?brand=/);
  const brandId = new URL(page.url()).searchParams.get("brand")!;

  await page.goto(`/brand-os?brand=${brandId}`);
  await page.getByTestId("brand-member-username").fill(MEMBER_USERNAME);
  await page.getByTestId("brand-member-add").click();
  await expect(
    page.getByTestId(`brand-member-${MEMBER_PROFILE_ID}`),
  ).toContainText("Contributor");

  const ownerDb = databaseClient();
  const ownerAuth = await ownerDb.auth.signInWithPassword({
    email: process.env.E2E_EMAIL!,
    password,
  });
  expect(ownerAuth.error).toBeNull();
  const ownerId = ownerAuth.data.user!.id;

  const memberDb = databaseClient();
  const memberAuth = await memberDb.auth.signInWithPassword({
    email: MEMBER_EMAIL,
    password,
  });
  expect(memberAuth.error).toBeNull();

  const { data: memberMembership } = await ownerDb
    .from("brand_memberships")
    .select("id")
    .eq("brand_id", brandId)
    .eq("profile_id", MEMBER_PROFILE_ID)
    .single();

  // Contributor publishes a post AS the brand, plus a personal post.
  const { data: brandPost, error: brandPostError } = await memberDb
    .from("posts")
    .insert({
      author_id: MEMBER_PROFILE_ID,
      content_type: "post",
      body: memberBrandPostBody,
      posting_as_type: "brand",
      brand_id: brandId,
    })
    .select("id")
    .single();
  expect(brandPostError).toBeNull();

  const { data: personalPost } = await memberDb
    .from("posts")
    .insert({
      author_id: MEMBER_PROFILE_ID,
      content_type: "post",
      body: memberPersonalPostBody,
    })
    .select("id")
    .single();

  // Owner removes the contributor from the brand.
  const removal = await ownerDb.rpc("remove_brand_member", {
    target_membership_id: memberMembership!.id,
  });
  expect(removal.error).toBeNull();
  const { data: gone } = await ownerDb
    .from("brand_memberships")
    .select("id")
    .eq("brand_id", brandId)
    .eq("profile_id", MEMBER_PROFILE_ID);
  expect(gone).toEqual([]);

  // Owner (manager) CAN edit the departed contributor's brand post.
  const ownerEdit = await ownerDb
    .from("posts")
    .update({ body: `${memberBrandPostBody} — edited by owner` })
    .eq("id", brandPost!.id)
    .select("id");
  expect(ownerEdit.data).toEqual([{ id: brandPost!.id }]);

  // Attribution immutability: the owner's edit cannot launder the post to a
  // different identity (existing trigger, proven not built here).
  const launder = await ownerDb
    .from("posts")
    .update({ author_id: ownerId })
    .eq("id", brandPost!.id)
    .select("id");
  expect(launder.error).not.toBeNull();

  // Owner cannot touch the contributor's PERSONAL post (rows 4-5 unchanged).
  const ownerPersonalEdit = await ownerDb
    .from("posts")
    .update({ body: "E2E owner forbidden personal edit" })
    .eq("id", personalPost!.id)
    .select("id");
  expect(ownerPersonalEdit.data).toEqual([]);

  // Owner (manager) soft-deletes the brand post via the RPC.
  const ownerDelete = await ownerDb.rpc("soft_delete_managed_post", {
    target_post_id: brandPost!.id,
  });
  expect(ownerDelete).toMatchObject({ data: true, error: null });

  // Deleted post is hidden from every read path (policy-level filter).
  const { data: hidden } = await ownerDb
    .from("posts")
    .select("id")
    .eq("id", brandPost!.id);
  expect(hidden).toEqual([]);
  const { data: feedHidden } = await ownerDb
    .from("unified_feed")
    .select("id")
    .eq("id", brandPost!.id);
  expect(feedHidden).toEqual([]);
  await page.goto(`/post/${brandPost!.id}`);
  await expect(page.getByTestId("edit-content")).toHaveCount(0);

  // The departed contributor (outsider, still nominal author) can neither
  // resurrect nor re-delete the removed post — it is terminal.
  const outsiderEdit = await memberDb
    .from("posts")
    .update({ body: "E2E departed member resurrect attempt" })
    .eq("id", brandPost!.id)
    .select("id");
  expect(outsiderEdit.data).toEqual([]);
  const outsiderDelete = await memberDb.rpc("soft_delete_managed_post", {
    target_post_id: brandPost!.id,
  });
  expect(outsiderDelete.data).toBe(false);

  // Audit trail: exactly the owner's edit + delete of the contributor's content,
  // readable by the owner (manager), invisible to the departed contributor.
  const { data: ownerEvents } = await ownerDb
    .from("brand_content_events")
    .select("action,content_kind,content_id,actor_id")
    .eq("brand_id", brandId)
    .eq("content_id", brandPost!.id)
    .order("created_at");
  expect(ownerEvents?.map((e) => e.action)).toEqual(["edit", "delete"]);
  expect(ownerEvents?.every((e) => e.actor_id === ownerId)).toBe(true);
  expect(ownerEvents?.every((e) => e.content_kind === "post")).toBe(true);

  const { data: outsiderEvents } = await memberDb
    .from("brand_content_events")
    .select("id")
    .eq("brand_id", brandId);
  expect(outsiderEvents).toEqual([]);

  // Cleanup: personal post hard-deletes (author path unchanged); the brand post
  // stays soft-deleted as evidence (matches listings; known dev-row chore).
  await memberDb.from("posts").delete().eq("id", personalPost!.id);
});
