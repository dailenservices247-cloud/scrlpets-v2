import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { MEMBER_EMAIL, SELLER_EMAIL, signInCached } from "./fixtures";

function databaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function signIn(email: string) {
  return signInCached(email);
}

/**
 * R17 — THE BYPASS TEST. "Free to a good home" is exactly where animal scams
 * operate, so adoption is held to the same gate as a sale. If a weaker path
 * ever appears, listing_kind = 'adoption' is where it would show up first.
 */
test("adoption cannot be used to dodge the verification gate", async () => {
  test.setTimeout(120_000);
  // The member fixture is deliberately NOT a verified seller.
  const { db, userId } = await signIn(MEMBER_EMAIL);
  const stamp = Date.now();

  const creature = await db
    .from("creatures")
    .insert({ owner_id: userId, name: `E2E adopt animal ${stamp}`, slug: `e2e-adopt-${stamp}` })
    .select("id")
    .single();
  expect(creature.error).toBeNull();
  const creatureId = creature.data!.id;
  await db.from("animal_eligibility").delete().eq("creature_id", creatureId);

  // A free adoption is still an animal listing, and is still blocked.
  const freeAdoption = await db.from("listings").insert({
    seller_id: userId,
    title: `E2E free adoption ${stamp}`,
    price_cents: 0,
    creature_id: creatureId,
    listing_kind: "adoption",
  });
  expect(freeAdoption.error).not.toBeNull();

  // Attesting the animal alone is not enough — identity is still missing.
  await db.rpc("attest_animal_eligibility", { target_creature: creatureId });
  const stillBlocked = await db.from("listings").insert({
    seller_id: userId,
    title: `E2E adoption half-gated ${stamp}`,
    price_cents: 0,
    creature_id: creatureId,
    listing_kind: "adoption",
  });
  expect(stillBlocked.error).not.toBeNull();

  await db.from("animal_eligibility").delete().eq("creature_id", creatureId);
  await db.from("creatures").delete().eq("id", creatureId);
});

/** An adoption must be about an animal — it cannot be a product in disguise. */
test("a product cannot be listed as an adoption", async () => {
  test.setTimeout(120_000);
  const { db, userId } = await signIn(SELLER_EMAIL);
  const attempt = await db.from("listings").insert({
    seller_id: userId,
    title: `E2E product-as-adoption ${Date.now()}`,
    price_cents: 0,
    listing_kind: "adoption",
  });
  expect(attempt.error).not.toBeNull();
});

/** D12 — the fee model is percentage/seller-paid, and the rate is still zero. */
test("fee model is seller-paid percentage with an unset rate", async () => {
  const db = databaseClient();
  const { data } = await db
    .from("platform_flags")
    .select("key,value_int")
    .eq("key", "fee_bps")
    .single();
  expect(data!.value_int, "rate stays 0 until Dailen names it").toBe(0);

  // The rate is not client-writable, same as the payments switch.
  await db.auth.signInWithPassword({
    email: SELLER_EMAIL,
    password: process.env.E2E_PASSWORD!,
  });
  const tamper = await db
    .from("platform_flags")
    .update({ value_int: 5000 }, { count: "exact" })
    .eq("key", "fee_bps");
  expect(tamper.count ?? 0).toBe(0);
});

/** The adoption surface is public and states the gate honestly. */
test("adoption surface is public and explains the checks", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/adopt");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("adopt-gate-notice")).toContainText("identity-verified");

  // Adoptions never leak into the product shop.
  const db = databaseClient();
  const adoptions = await db
    .from("listings")
    .select("id")
    .eq("listing_kind", "adoption")
    .is("deleted_at", null)
    .limit(5);
  await page.goto("/shop");
  for (const a of adoptions.data ?? []) {
    await expect(page.locator(`a[href="/listing/${a.id}"]`)).toHaveCount(0);
  }
});
