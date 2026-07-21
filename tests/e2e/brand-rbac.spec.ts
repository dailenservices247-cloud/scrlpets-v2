import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";

const MEMBER_EMAIL = "scrlpets-rbac-e2e@scrlpets.com";
const MEMBER_PROFILE_ID = "8f62eba7-aa0a-4603-8134-5e37ca74ab23";
const MEMBER_USERNAME = "scrlpets-rbac-e2e_8f62";
const THIRD_PROFILE_ID = "2138dc38-36de-41b0-863e-34028cbd301a";
const THIRD_USERNAME = "scrlpets-rbac-third_2138";

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
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
}

async function expectNoSeriousA11y(page: Page) {
  await expect(page).toHaveTitle(/\S+/);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    serious,
    JSON.stringify(
      serious.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.length,
      })),
      null,
      2,
    ),
  ).toEqual([]);
}

test("owner, admin, and contributor permissions stay inside the brand boundary", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const password = process.env.E2E_PASSWORD!;
  const brandName = `E2E RBAC Brand ${Date.now()}`;
  const ownerBrandPostBody = `E2E owner brand post ${Date.now()}`;
  const memberBrandPostBody = `E2E member brand post ${Date.now()}`;
  const ownerPersonalPostBody = `E2E owner personal post ${Date.now()}`;
  const ownerBrandListingTitle = `E2E owner brand listing ${Date.now()}`;

  await signIn(page, process.env.E2E_EMAIL!);
  await page.goto("/brands/new");
  await page.getByTestId("brand-name").fill(brandName);
  await page.getByTestId("brand-create-submit").click();
  await expect(page).toHaveURL(/\/compose\?brand=/);
  const brandId = new URL(page.url()).searchParams.get("brand")!;

  await page.goto(`/brand-os?brand=${brandId}`);
  await expect(page.getByTestId("brand-members-panel")).toBeVisible();
  await expectNoSeriousA11y(page);

  await page.getByTestId("brand-member-username").fill("missing-rbac-user");
  await page.getByTestId("brand-member-add").click();
  await expect(
    page.getByText("No Scrlpets profile has that exact username."),
  ).toBeVisible();

  await page.getByTestId("brand-member-username").fill(MEMBER_USERNAME);
  await page.getByTestId("brand-member-add").click();
  const memberRow = page.getByTestId(`brand-member-${MEMBER_PROFILE_ID}`);
  await expect(memberRow).toContainText("Contributor");

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

  const { data: ownerMembership } = await ownerDb
    .from("brand_memberships")
    .select("id")
    .eq("brand_id", brandId)
    .eq("profile_id", ownerId)
    .single();
  const { data: memberMembership } = await ownerDb
    .from("brand_memberships")
    .select("id,role")
    .eq("brand_id", brandId)
    .eq("profile_id", MEMBER_PROFILE_ID)
    .single();
  expect(memberMembership?.role).toBe("contributor");

  const directAuditInsert = await ownerDb
    .from("brand_membership_events")
    .insert({
      brand_id: brandId,
      actor_id: ownerId,
      target_profile_id: ownerId,
      action: "member_added",
      new_role: "owner",
    });
  expect(directAuditInsert.error).not.toBeNull();

  const duplicate = await ownerDb.rpc("add_brand_member", {
    target_brand_id: brandId,
    target_profile_id: MEMBER_PROFILE_ID,
    target_role: "contributor",
  });
  expect(duplicate.error?.message).toContain("duplicate_member");

  const { data: ownerBrandPost, error: ownerBrandPostError } = await ownerDb
    .from("posts")
    .insert({
      author_id: ownerId,
      content_type: "post",
      body: ownerBrandPostBody,
      posting_as_type: "brand",
      brand_id: brandId,
    })
    .select("id")
    .single();
  expect(ownerBrandPostError).toBeNull();

  const { data: ownerPersonalPost, error: ownerPersonalPostError } =
    await ownerDb
      .from("posts")
      .insert({
        author_id: ownerId,
        content_type: "post",
        body: ownerPersonalPostBody,
      })
      .select("id")
      .single();
  expect(ownerPersonalPostError).toBeNull();

  const { data: ownerBrandListing, error: ownerBrandListingError } =
    await ownerDb
      .from("listings")
      .insert({
        seller_id: ownerId,
        title: ownerBrandListingTitle,
        price_cents: 12500,
        posting_as_type: "brand",
        brand_id: brandId,
      })
      .select("id")
      .single();
  expect(ownerBrandListingError).toBeNull();

  const { data: memberBrandPost, error: memberBrandPostError } = await memberDb
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
  expect(memberBrandPostError).toBeNull();

  const contributorCrossEdit = await memberDb
    .from("posts")
    .update({ body: "E2E contributor forbidden cross-edit" })
    .eq("id", ownerBrandPost!.id)
    .select("id");
  expect(contributorCrossEdit.data).toEqual([]);
  const contributorListingEdit = await memberDb
    .from("listings")
    .update({ title: "E2E contributor forbidden listing edit" })
    .eq("id", ownerBrandListing!.id)
    .select("id");
  expect(contributorListingEdit.data).toEqual([]);

  await signIn(page, MEMBER_EMAIL);
  await page.goto(`/brand-os?brand=${brandId}`);
  await expect(page.getByText("Your access: Contributor")).toBeVisible();
  await expect(page.getByTestId("brand-member-add-form")).toHaveCount(0);
  await page.goto(`/post/${memberBrandPost!.id}`);
  await expect(page.getByTestId("edit-content")).toBeVisible();
  await page.goto(`/post/${ownerBrandPost!.id}`);
  await expect(page.getByTestId("edit-content")).toHaveCount(0);

  await signIn(page, process.env.E2E_EMAIL!);
  await page.goto(`/brand-os?brand=${brandId}`);
  await memberRow.getByRole("button", { name: "Make Admin" }).click();
  await expect(page.getByRole("status")).toHaveText("Role updated.");
  await expect(memberRow.getByText("Admin", { exact: true })).toBeVisible();

  await signIn(page, MEMBER_EMAIL);
  await page.goto(`/brand-os?brand=${brandId}`);
  await expect(page.getByText("Your access: Admin")).toBeVisible();
  await expect(page.getByTestId("brand-member-add-form")).toBeVisible();

  const adminCannotAddAdmin = await memberDb.rpc("add_brand_member", {
    target_brand_id: brandId,
    target_profile_id: THIRD_PROFILE_ID,
    target_role: "admin",
  });
  expect(adminCannotAddAdmin.error?.message).toContain(
    "brand_permission_denied",
  );

  await page.getByTestId("brand-member-username").fill(THIRD_USERNAME);
  await page.getByTestId("brand-member-add").click();
  const thirdRow = page.getByTestId(`brand-member-${THIRD_PROFILE_ID}`);
  await expect(thirdRow).toContainText("Contributor");

  const adminCrossEdit = await memberDb
    .from("posts")
    .update({ body: `${ownerBrandPostBody} admin edited` })
    .eq("id", ownerBrandPost!.id)
    .select("id");
  expect(adminCrossEdit.data).toEqual([{ id: ownerBrandPost!.id }]);
  const adminListingEdit = await memberDb
    .from("listings")
    .update({ title: `${ownerBrandListingTitle} admin edited` })
    .eq("id", ownerBrandListing!.id)
    .select("id");
  expect(adminListingEdit.data).toEqual([{ id: ownerBrandListing!.id }]);

  const adminPersonalEdit = await memberDb
    .from("posts")
    .update({ body: "E2E admin forbidden personal edit" })
    .eq("id", ownerPersonalPost!.id)
    .select("id");
  expect(adminPersonalEdit.data).toEqual([]);
  const adminListingDelete = await memberDb.rpc(
    "soft_delete_managed_listing",
    { target_listing_id: ownerBrandListing!.id },
  );
  expect(adminListingDelete).toMatchObject({ data: true, error: null });
  const { data: hiddenListing } = await ownerDb
    .from("listings")
    .select("id")
    .eq("id", ownerBrandListing!.id);
  expect(hiddenListing).toEqual([]);

  await page.goto(`/post/${ownerBrandPost!.id}`);
  await expect(page.getByTestId("edit-content")).toBeVisible();
  await page.goto(`/brand-os?brand=${brandId}`);
  await thirdRow
    .getByRole("button", { name: "Remove member" })
    .click();
  await expect(thirdRow).toHaveCount(0);

  const ownerRemoval = await ownerDb.rpc("remove_brand_member", {
    target_membership_id: ownerMembership!.id,
  });
  expect(ownerRemoval.error?.message).toContain("owner_protected");

  const { data: events, error: eventsError } = await ownerDb
    .from("brand_membership_events")
    .select("action")
    .eq("brand_id", brandId)
    .order("created_at");
  expect(eventsError).toBeNull();
  expect(events?.map((event) => event.action)).toEqual([
    "member_added",
    "role_changed",
    "member_added",
    "member_removed",
  ]);
  const directAuditUpdate = await ownerDb
    .from("brand_membership_events")
    .update({ action: "role_changed" })
    .eq("brand_id", brandId);
  expect(directAuditUpdate.error).not.toBeNull();

  await signIn(page, MEMBER_EMAIL);
  await page.goto(`/brand-os?brand=${brandId}`);
  await page
    .getByTestId(`brand-member-${MEMBER_PROFILE_ID}`)
    .getByRole("button", { name: "Leave brand" })
    .click();
  await expect(page).toHaveURL("http://localhost:3000/brand-os");
  const { data: departedMembership } = await ownerDb
    .from("brand_memberships")
    .select("id")
    .eq("brand_id", brandId)
    .eq("profile_id", MEMBER_PROFILE_ID);
  expect(departedMembership).toEqual([]);

  await ownerDb.from("posts").delete().in("id", [
    ownerBrandPost!.id,
    ownerPersonalPost!.id,
    memberBrandPost!.id,
  ]);
});
