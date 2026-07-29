import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { MEMBER_EMAIL, MEMBER_PROFILE_ID, SELLER_EMAIL } from "./fixtures";

function databaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

/**
 * Phase 2 — THE P0: an animal listing requires a verified seller AND that
 * specific animal attested. Enforced by RLS, so these assertions run straight
 * against the database: no UI path can be the thing that's "protecting" it.
 */
test("animal listings are BLOCKED without verification (the P0)", async () => {
  test.setTimeout(120_000);
  // Uses the MEMBER fixture, which is deliberately NOT a verified seller, so
  // this never disturbs the seeded verified seller other specs rely on.
  const db = databaseClient();
  const auth = await db.auth.signInWithPassword({
    email: MEMBER_EMAIL,
    password: process.env.E2E_PASSWORD!,
  });
  const userId = auth.data.user!.id;
  expect(userId).toBe(MEMBER_PROFILE_ID);

  const stamp = Date.now();
  const creature = await db
    .from("creatures")
    .insert({ owner_id: userId, name: `E2E gate animal ${stamp}`, slug: `e2e-gate-${stamp}` })
    .select("id")
    .single();
  expect(creature.error).toBeNull();
  const creatureId = creature.data!.id;
  await db.from("animal_eligibility").delete().eq("creature_id", creatureId);

  // 1. Unverified seller → animal listing BLOCKED.
  const blocked = await db.from("listings").insert({
    seller_id: userId,
    title: `E2E gated listing ${stamp}`,
    price_cents: 50000,
    creature_id: creatureId,
  });
  expect(blocked.error).not.toBeNull();

  // 2. Attesting the animal alone is NOT enough — identity still missing.
  await db.rpc("attest_animal_eligibility", { target_creature: creatureId });
  const stillBlocked = await db.from("listings").insert({
    seller_id: userId,
    title: `E2E half-gated ${stamp}`,
    price_cents: 50000,
    creature_id: creatureId,
  });
  expect(stillBlocked.error).not.toBeNull();

  // 3. A NON-animal listing is unaffected by the gate (D3).
  const productTitle = `E2E product listing ${stamp}`;
  const product = await db.from("listings").insert({
    seller_id: userId,
    title: productTitle,
    price_cents: 2500,
  });
  expect(product.error).toBeNull();

  // 4. Verification cannot be self-granted — no client write path exists.
  const selfGrant = await db
    .from("identity_verifications")
    .insert({ profile_id: userId, status: "verified" });
  expect(selfGrant.error).not.toBeNull();

  // 5. Nobody can attest an animal they do not own.
  const otherDb = databaseClient();
  await otherDb.auth.signInWithPassword({
    email: SELLER_EMAIL,
    password: process.env.E2E_PASSWORD!,
  });
  const notOwner = await otherDb.rpc("attest_animal_eligibility", {
    target_creature: creatureId,
  });
  expect(notOwner.error?.message).toContain("not_owner");

  // Cleanup.
  await db.from("listings").delete().eq("title", productTitle);
  await db.from("animal_eligibility").delete().eq("creature_id", creatureId);
  await db.from("creatures").delete().eq("id", creatureId);
});

/**
 * The unblock half. record_identity_result is revoked from authenticated by
 * design (only the signed webhook may call it), so this runs only where a
 * service-role key is available; the blocking half above always runs.
 */
test("a verified seller with an attested animal CAN list", async () => {
  test.skip(
    !process.env.SUPABASE_SERVICE_ROLE_KEY,
    "needs SUPABASE_SERVICE_ROLE_KEY; identity results are webhook-only by design",
  );
  test.setTimeout(120_000);
  const db = databaseClient();
  const auth = await db.auth.signInWithPassword({
    email: SELLER_EMAIL,
    password: process.env.E2E_PASSWORD!,
  });
  const userId = auth.data.user!.id;
  const stamp = Date.now();

  const creature = await db
    .from("creatures")
    .insert({ owner_id: userId, name: `E2E ok animal ${stamp}`, slug: `e2e-ok-${stamp}` })
    .select("id")
    .single();
  const creatureId = creature.data!.id;

  await db.rpc("start_identity_verification", { session_ref: "vs_e2e_test" });
  const asService = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
  const recorded = await asService.rpc("record_identity_result", {
    target_profile: userId,
    session_ref: "vs_e2e_test",
    new_status: "verified",
  });
  expect(recorded.error).toBeNull();

  await db.rpc("attest_animal_eligibility", { target_creature: creatureId });
  const allowedTitle = `E2E allowed listing ${stamp}`;
  const allowed = await db.from("listings").insert({
    seller_id: userId,
    title: allowedTitle,
    price_cents: 50000,
    creature_id: creatureId,
  });
  expect(allowed.error).toBeNull();

  await db.from("listings").delete().eq("title", allowedTitle);
  await db.from("animal_eligibility").delete().eq("creature_id", creatureId);
  await db.from("creatures").delete().eq("id", creatureId);
});

/** Program credentials: reference-only, self-approval impossible. */
test("program credentials are admin-reviewed and never self-approved", async () => {
  const db = databaseClient();
  const auth = await db.auth.signInWithPassword({
    email: SELLER_EMAIL,
    password: process.env.E2E_PASSWORD!,
  });
  const userId = auth.data.user!.id;

  const submitted = await db
    .from("seller_programs")
    .insert({
      profile_id: userId,
      program_type: "kennel",
      credential_number: `E2E-${Date.now()}`,
      issuing_authority: "E2E Dept. of Agriculture",
    })
    .select("id, status")
    .single();
  expect(submitted.error).toBeNull();
  expect(submitted.data!.status).toBe("pending");

  // No client UPDATE policy: you cannot approve your own credential.
  const selfApprove = await db
    .from("seller_programs")
    .update({ status: "approved" }, { count: "exact" })
    .eq("id", submitted.data!.id);
  expect(selfApprove.count ?? 0).toBe(0);

  // The review RPC refuses a non-admin outright.
  const notAdmin = await db.rpc("review_seller_program", {
    target_program: submitted.data!.id,
    decision: "approved",
  });
  expect(notAdmin.error?.message).toContain("admin_required");

  // Platform roles cannot be self-granted either (no insert policy at all).
  const selfAdmin = await db
    .from("platform_roles")
    .insert({ profile_id: userId, role: "admin" });
  expect(selfAdmin.error).not.toBeNull();

  await db.from("seller_programs").delete().eq("id", submitted.data!.id);
});

/** The verification surface renders and reports honestly when unconfigured. */
test("verification page shows identity, program and animal sections", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

  await page.goto("/settings/verification");
  await expect(page.getByTestId("verification-panel")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("identity-status")).toBeVisible();
  await expect(page.getByTestId("program-submit")).toBeVisible();

  // /admin is invisible to non-admins.
  await page.goto("/admin");
  await expect(page.getByTestId("admin-queue")).toHaveCount(0);
  await expect(page.getByTestId("admin-queue-empty")).toHaveCount(0);
});
