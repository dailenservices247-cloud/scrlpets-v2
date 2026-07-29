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

// Per-brand restrict-posting: when the owner restricts posting-as-brand, a
// contributor can no longer publish as the brand (DB-enforced), while managers
// still can; the setting round-trips through the manager-gated RPC.
test("owner can restrict posting-as-brand to managers", async ({ page }) => {
  test.setTimeout(120_000);
  const password = process.env.E2E_PASSWORD!;
  const brandName = `E2E Restrict Brand ${Date.now()}`;
  const contributorPost = `E2E restrict contributor post ${Date.now()}`;
  const managerPost = `E2E restrict manager post ${Date.now()}`;

  await signIn(page, SELLER_EMAIL);
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

  const { db: ownerDb, userId: __uid_ownerDb } = await signInCached(SELLER_EMAIL);
  const ownerAuth = { data: { user: { id: __uid_ownerDb } }, error: null };
  expect(ownerAuth.error).toBeNull();
  const ownerId = ownerAuth.data.user!.id;

  const { db: memberDb } = await signInCached(MEMBER_EMAIL);

  // Default (unrestricted): the contributor CAN post as the brand.
  const beforeRestrict = await memberDb
    .from("posts")
    .insert({
      author_id: MEMBER_PROFILE_ID,
      content_type: "post",
      body: `${contributorPost} before`,
      posting_as_type: "brand",
      brand_id: brandId,
    })
    .select("id")
    .single();
  expect(beforeRestrict.error).toBeNull();

  // Owner restricts via the Brand OS toggle.
  await page.goto(`/brand-os?brand=${brandId}`);
  await expect(page.getByTestId("brand-posting-state")).toHaveText("Any member");
  await page.getByTestId("brand-posting-toggle").click();
  await expect(page.getByTestId("brand-posting-state")).toHaveText(
    "Admins and owners only",
  );

  // Now the contributor is DB-blocked from posting as the brand.
  const afterRestrict = await memberDb
    .from("posts")
    .insert({
      author_id: MEMBER_PROFILE_ID,
      content_type: "post",
      body: `${contributorPost} after`,
      posting_as_type: "brand",
      brand_id: brandId,
    })
    .select("id");
  expect(afterRestrict.error).not.toBeNull();

  // A contributor cannot flip the flag off (manager-gated RPC).
  const contributorToggle = await memberDb.rpc(
    "set_brand_posting_restriction",
    { target_brand_id: brandId, restrict: false },
  );
  expect(contributorToggle.error?.message).toContain("brand_permission_denied");

  // The owner (manager) can still post as the restricted brand.
  const ownerPost = await ownerDb
    .from("posts")
    .insert({
      author_id: ownerId,
      content_type: "post",
      body: managerPost,
      posting_as_type: "brand",
      brand_id: brandId,
    })
    .select("id")
    .single();
  expect(ownerPost.error).toBeNull();

  // The contributor's own personal posting is unaffected.
  const personal = await memberDb
    .from("posts")
    .insert({
      author_id: MEMBER_PROFILE_ID,
      content_type: "post",
      body: `${contributorPost} personal`,
    })
    .select("id")
    .single();
  expect(personal.error).toBeNull();

  await memberDb.rpc("soft_delete_managed_post", { target_post_id: personal.data!.id });
});
