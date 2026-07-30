import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { MEMBER_EMAIL, SELLER_EMAIL, signInCached } from "./fixtures";

function databaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function signIn(page: Page) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
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
  const { db: db, userId: __uid_db } = await signInCached(SELLER_EMAIL);
  const auth = { data: { user: { id: __uid_db } }, error: null };
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

  // B.5/R3: litters are created at /litters now — Brand OS's name-only stub
  // creator was deleted so each entity has exactly one creation path. This
  // spec's subject is the SUBJECT LAYER, so it seeds the litter directly and
  // keeps its real assertions (tagging + the DB's refusal of fake subjects);
  // the litter wizard itself is covered by litters.spec.ts.
  const { data: litter, error: litterError } = await db
    .from("litters")
    .insert({ owner_id: userId, brand_id: brandId, name: litterName })
    .select("id")
    .single();
  expect(litterError).toBeNull();


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
    email: MEMBER_EMAIL,
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
