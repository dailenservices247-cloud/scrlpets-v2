import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

function databaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
}

// Slice C: subjects stop being references to nothing — litters/services are
// real entities, the composer only offers what exists, and the DB refuses
// fabricated subject ids.
test("litter creation, subject-tagged post, and DB refusal of fake subjects", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const db = databaseClient();
  const auth = await db.auth.signInWithPassword({
    email: process.env.E2E_EMAIL!,
    password: process.env.E2E_PASSWORD!,
  });
  const userId = auth.data.user!.id;
  const brandName = `E2E Subject Brand ${Date.now()}`;
  const litterName = `E2E Spring Litter ${Date.now()}`;
  const postBody = `E2E litter post ${Date.now()}`;

  // Owner creates a brand, then adds a litter by name in Brand OS.
  await signIn(page);
  await page.goto("/brands/new");
  await page.getByTestId("brand-name").fill(brandName);
  await page.getByTestId("brand-create-submit").click();
  await expect(page).toHaveURL(/\/compose\?brand=/, { timeout: 20_000 });
  const brandId = new URL(page.url()).searchParams.get("brand")!;

  await page.goto(`/brand-os?brand=${brandId}`);
  await expect(page.getByTestId("subject-entities-panel")).toBeVisible();
  await page.getByTestId("new-litter-name").fill(litterName);
  await page.getByTestId("add-litter").click();
  await expect(page.getByTestId("litter-chip").filter({ hasText: litterName })).toBeVisible();

  const { data: litter } = await db
    .from("litters")
    .select("id")
    .eq("name", litterName)
    .single();

  // Compose a post ABOUT that litter through the subject picker.
  await page.goto("/compose");
  await page.getByTestId("composer-more-options").click();
  await page.getByTestId("about-litter").click();
  await page.getByTestId("subject-select").selectOption(litter!.id);
  await page.getByTestId("post-body").fill(postBody);
  await page.getByTestId("post-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });

  const { data: post } = await db
    .from("posts")
    .select("id, about_type, about_id")
    .eq("body", postBody)
    .single();
  expect(post!.about_type).toBe("litter");
  expect(post!.about_id).toBe(litter!.id);

  // The DB refuses subjects that don't exist, and subjects without ids.
  const fake = await db.from("posts").insert({
    author_id: userId,
    content_type: "post",
    body: "E2E fake subject",
    about_type: "litter",
    about_id: "00000000-0000-0000-0000-00000000dead",
  });
  expect(fake.error?.message).toContain("subject_invalid");
  const missing = await db.from("posts").insert({
    author_id: userId,
    content_type: "post",
    body: "E2E idless subject",
    about_type: "service",
  });
  expect(missing.error?.message).toContain("subject_required");
  // 'animal' is no longer a subject label — the creature FK is the mechanism.
  const dead = await db.from("posts").insert({
    author_id: userId,
    content_type: "post",
    body: "E2E dead enum",
    about_type: "animal",
  });
  expect(dead.error).not.toBeNull();

  // A non-manager cannot create a litter under someone else's brand (RLS).
  const memberDb = databaseClient();
  await memberDb.auth.signInWithPassword({
    email: "scrlpets-rbac-e2e@scrlpets.com",
    password: process.env.E2E_PASSWORD!,
  });
  const {
    data: { user: member },
  } = await memberDb.auth.getUser();
  const hijack = await memberDb.from("litters").insert({
    owner_id: member!.id,
    brand_id: brandId,
    name: "E2E hijack litter",
  });
  expect(hijack.error).not.toBeNull();

  // Cleanup.
  await db.rpc("soft_delete_managed_post", { target_post_id: post!.id });
  await db.from("litters").delete().eq("id", litter!.id);
});
