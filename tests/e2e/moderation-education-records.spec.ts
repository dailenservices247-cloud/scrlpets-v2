import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { MEMBER_EMAIL, SELLER_EMAIL, signInCached } from "./fixtures";

/**
 * Opt-in only. This project's Supabase instance serves production as well as
 * local dev, so a permanently-admin test fixture would be a real admin account
 * on the live database with a shared password. Set E2E_ADMIN_EMAIL locally,
 * against a throwaway project, to run the admin-surface test.
 */
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL;

function databaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function signIn() {
  const { db: db, userId: __uid_db } = await signInCached(SELLER_EMAIL);
  const auth = { data: { user: { id: __uid_db } }, error: null };
  return { db, userId: auth.data.user!.id };
}

/**
 * D4 — moderation authority lives in the DB. A non-admin can file a report and
 * can never resolve one, hide content, or suspend anybody.
 */
test("moderation decisions are admin-only and audited", async () => {
  test.setTimeout(120_000);
  const { db, userId } = await signIn();
  const stamp = Date.now();

  const post = await db
    .from("posts")
    .insert({ author_id: userId, body: `E2E mod post ${stamp}`, posting_as_type: "person" })
    .select("id")
    .single();
  expect(post.error).toBeNull();
  const postId = post.data!.id;

  const report = await db
    .from("content_reports")
    .insert({ reporter_id: userId, target_kind: "post", target_id: postId, reason: "spam" })
    .select("id")
    .single();
  expect(report.error).toBeNull();

  // The definer refuses a non-admin outright.
  const notAdmin = await db.rpc("resolve_report", {
    target_report: report.data!.id,
    decision: "content_hidden",
  });
  expect(notAdmin.error?.message).toContain("admin_required");

  // No client UPDATE policy on reports — you cannot self-resolve either.
  const selfResolve = await db
    .from("content_reports")
    .update({ status: "resolved" }, { count: "exact" })
    .eq("id", report.data!.id);
  expect(selfResolve.count ?? 0).toBe(0);

  // Suspension lives in its own table with NO client write policy, so a
  // suspended member can neither clear their own suspension nor forge one.
  const selfUnsuspend = await db
    .from("account_suspensions")
    .delete({ count: "exact" })
    .eq("profile_id", userId);
  expect(selfUnsuspend.count ?? 0).toBe(0);
  const forgeSuspension = await db
    .from("account_suspensions")
    .insert({ profile_id: userId });
  expect(forgeSuspension.error).not.toBeNull();

  // The audit log is never client-writable.
  const forgeAudit = await db
    .from("moderation_actions")
    .insert({ actor_id: userId, action: "dismissed" });
  expect(forgeAudit.error).not.toBeNull();

  await db.from("content_reports").delete().eq("id", report.data!.id);
  await db.from("posts").delete().eq("id", postId);
});

/** D6 — owner-declared records are editable; vet attestation is not forgeable. */
test("animal records are owner-declared and vet attestation cannot be self-written", async () => {
  test.setTimeout(120_000);
  const { db, userId } = await signIn();
  const stamp = Date.now();

  const creature = await db
    .from("creatures")
    .insert({ owner_id: userId, name: `E2E records ${stamp}`, slug: `e2e-records-${stamp}` })
    .select("id")
    .single();
  expect(creature.error).toBeNull();
  const creatureId = creature.data!.id;

  const saved = await db
    .from("animal_records")
    .insert({ creature_id: creatureId, vaccinations_declared: "Rabies 2026-01" });
  expect(saved.error).toBeNull();

  // Forging an attestation on insert or update is blocked by the DB trigger.
  const forgedUpdate = await db
    .from("animal_records")
    .update({ vet_attested_by: userId, vet_attested_at: new Date().toISOString() })
    .eq("creature_id", creatureId);
  expect(forgedUpdate.error?.message).toContain("vet_attestation_not_self_writable");

  // A different owner cannot write records for an animal that is not theirs.
  const other = databaseClient();
  await other.auth.signInWithPassword({
    email: MEMBER_EMAIL,
    password: process.env.E2E_PASSWORD!,
  });
  const notOwner = await other
    .from("animal_records")
    .update({ health_notes_declared: "hijacked" }, { count: "exact" })
    .eq("creature_id", creatureId);
  expect(notOwner.count ?? 0).toBe(0);

  await db.from("animal_records").delete().eq("creature_id", creatureId);
  await db.from("creatures").delete().eq("id", creatureId);
});

/** D5 — unpublished guides never reach the public surface. */
test("guides surface renders and shows only published guides", async ({ page }) => {
  const db = databaseClient();
  const drafts = await db.from("guides").select("slug").is("published_at", null);
  // Anonymous reads must not see drafts at all, regardless of how many exist.
  expect(drafts.data ?? []).toEqual([]);

  // Authoring is admin-only.
  const write = await db.from("guides").insert({
    slug: `e2e-guide-${Date.now()}`,
    title: "E2E",
    body: "E2E",
  });
  expect(write.error).not.toBeNull();

  await page.goto("/guides");
  await expect(page.getByRole("heading", { name: "Guides", level: 1 })).toBeVisible({
    timeout: 20_000,
  });
});

/** The admin surface renders all three review queues for an actual admin. */
test("admin surface renders reports, programs and guide drafts", async ({ page }) => {
  test.skip(
    !ADMIN_EMAIL,
    "needs E2E_ADMIN_EMAIL; no standing admin fixture exists on the shared project",
  );
  test.setTimeout(120_000);
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(ADMIN_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin", level: 1 })).toBeVisible({
    timeout: 20_000,
  });
  // Each queue renders either its list or its empty state — never nothing.
  for (const [list, empty] of [
    ["report-queue", "report-queue-empty"],
    ["admin-queue", "admin-queue-empty"],
    ["guide-queue", "guide-queue-empty"],
  ]) {
    const shown =
      (await page.getByTestId(list).count()) + (await page.getByTestId(empty).count());
    expect(shown, `${list} rendered`).toBeGreaterThan(0);
  }
  // The drafts seeded for approval are visible here and nowhere public.
  await expect(page.getByTestId("guide-publish-buying-an-animal-safely")).toBeVisible();
});
