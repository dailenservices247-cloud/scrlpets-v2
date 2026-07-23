import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const MEMBER_EMAIL = "scrlpets-rbac-e2e@scrlpets.com";
const BANNER_URL = "https://example.com/e2e-brand-banner.png";

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

// F3: brand identity (banner via manager-only RPC) + the listing destination
// as a gateway into the seller's world (brand link + more-from rail).
test("brand banner renders and a listing gateways into the brand's world", async ({
  page,
}) => {
  const password = process.env.E2E_PASSWORD!;
  const brandName = `E2E Gateway Brand ${Date.now()}`;
  const listingOne = `E2E gateway listing one ${Date.now()}`;
  const listingTwo = `E2E gateway listing two ${Date.now()}`;

  const ownerDb = databaseClient();
  const ownerAuth = await ownerDb.auth.signInWithPassword({
    email: process.env.E2E_EMAIL!,
    password,
  });
  const ownerId = ownerAuth.data.user!.id;
  const memberDb = databaseClient();
  await memberDb.auth.signInWithPassword({ email: MEMBER_EMAIL, password });

  // Owner creates a brand through the UI (slug derives from the name).
  await signIn(page, process.env.E2E_EMAIL!);
  await page.goto("/brands/new");
  await page.getByTestId("brand-name").fill(brandName);
  await page.getByTestId("brand-create-submit").click();
  // Tolerant: the create redirect pays /compose first-compile on a cold server.
  await expect(page).toHaveURL(/\/compose\?brand=/, { timeout: 20_000 });
  const brandId = new URL(page.url()).searchParams.get("brand")!;
  const { data: brandRow } = await ownerDb
    .from("brands")
    .select("slug")
    .eq("id", brandId)
    .single();
  const slug = brandRow!.slug;

  // Manager sets the banner via the identity RPC; a non-member cannot.
  const set = await ownerDb.rpc("set_brand_identity", {
    target_brand_id: brandId,
    new_banner_url: BANNER_URL,
  });
  expect(set.error).toBeNull();
  const denied = await memberDb.rpc("set_brand_identity", {
    target_brand_id: brandId,
    new_banner_url: "https://example.com/hijack.png",
  });
  expect(denied.error?.message).toContain("brand_permission_denied");

  // The public brand page renders the banner.
  await page.goto(`/b/${slug}`);
  await expect(page.getByTestId("brand-banner")).toHaveAttribute(
    "src",
    BANNER_URL,
  );

  // Two brand listings; the first one's destination gateways to the brand.
  const { data: l1 } = await ownerDb
    .from("listings")
    .insert({
      seller_id: ownerId,
      title: listingOne,
      price_cents: 10000,
      posting_as_type: "brand",
      brand_id: brandId,
    })
    .select("id")
    .single();
  const { data: l2 } = await ownerDb
    .from("listings")
    .insert({
      seller_id: ownerId,
      title: listingTwo,
      price_cents: 20000,
      posting_as_type: "brand",
      brand_id: brandId,
    })
    .select("id")
    .single();

  await page.goto(`/listing/${l1!.id}`);
  await expect(page.getByTestId("listing-brand-gateway")).toBeVisible();
  const rail = page.getByTestId("more-listings-rail");
  await expect(rail).toContainText(listingTwo);
  await rail.getByText(listingTwo).click();
  await expect(page).toHaveURL(new RegExp(`/listing/${l2!.id}`));

  // The gateway link itself lands on the brand's public page.
  await page.goto(`/listing/${l1!.id}`);
  await page.getByTestId("gateway-link").click();
  await expect(page).toHaveURL(new RegExp(`/b/${slug}`));

  // Cleanup: soft-delete the listings (evidence rows persist, feed hides them).
  await ownerDb.rpc("soft_delete_managed_listing", { target_listing_id: l1!.id });
  await ownerDb.rpc("soft_delete_managed_listing", { target_listing_id: l2!.id });
});
