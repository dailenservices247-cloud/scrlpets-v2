import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";

const BUYER_EMAIL = "scrlpets-rbac-e2e@scrlpets.com";

function databaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function signIn(email: string) {
  const db = databaseClient();
  const auth = await db.auth.signInWithPassword({
    email,
    password: process.env.E2E_PASSWORD!,
  });
  return { db, userId: auth.data.user!.id };
}

/**
 * THE POINTS GATE. Points are awarded by the database in response to real
 * events. If a client can write the ledger, the whole economy is fiction and
 * so is anything it buys.
 */
test("points cannot be granted, edited or deleted by a client", async () => {
  test.setTimeout(120_000);
  const { db, userId } = await signIn(process.env.E2E_EMAIL!);

  const forge = await db
    .from("point_ledger")
    .insert({ profile_id: userId, delta: 100000, reason: "forged" });
  expect(forge.error, "no client INSERT on the ledger").not.toBeNull();

  const awardDirect = await db.rpc("award_points", {
    target_profile: userId,
    amount: 100000,
    why: "forged",
    rtype: "x",
    rid: userId,
  });
  expect(awardDirect.error, "award_points is not callable by a client").not.toBeNull();

  const edit = await db
    .from("point_ledger")
    .update({ delta: 999 }, { count: "exact" })
    .eq("profile_id", userId);
  expect(edit.count ?? 0).toBe(0);

  const wipe = await db.from("point_ledger").delete({ count: "exact" }).eq("profile_id", userId);
  expect(wipe.count ?? 0).toBe(0);

  // Another member's balance is not readable.
  const other = await signIn(BUYER_EMAIL);
  const peek = await other.db.from("point_ledger").select("delta").eq("profile_id", userId);
  expect(peek.data ?? []).toEqual([]);
});

/** Nothing in the catalog converts to cash, and disabled rewards stay refused. */
test("no reward converts to cash and disabled rewards cannot be redeemed", async () => {
  test.setTimeout(120_000);
  const { db } = await signIn(process.env.E2E_EMAIL!);

  const { data: catalog } = await db.from("reward_catalog").select("key,kind,enabled");
  const kinds = new Set((catalog ?? []).map((c: { kind: string }) => c.kind));
  expect([...kinds].sort(), "no cash kind exists").toEqual(["fee_credit", "goods", "visibility"]);

  // The fee credit ships disabled pending legal review.
  const feeCredit = (catalog ?? []).find((c: { key: string }) => c.key === "fee_credit_10");
  expect(feeCredit!.enabled, "fee credit is off until A3").toBe(false);
  const attempt = await db.rpc("redeem_reward", { reward: "fee_credit_10", target_post: null });
  expect(attempt.error?.message).toContain("reward_not_available");

  // The catalog is not client-writable — you cannot enable a reward yourself.
  const enable = await db
    .from("reward_catalog")
    .update({ enabled: true, cost_points: 1 }, { count: "exact" })
    .eq("key", "fee_credit_10");
  expect(enable.count ?? 0).toBe(0);

  // Redemptions cannot be forged directly either.
  const forgeRedemption = await db.from("redemptions").insert({
    profile_id: (await db.auth.getUser()).data.user!.id,
    reward_key: "swag_pack",
    points_spent: 0,
  });
  expect(forgeRedemption.error).not.toBeNull();
});

/** Spending refuses to overdraw, and a boost only applies to your own post. */
test("redeeming refuses an overdraft and refuses someone else's post", async () => {
  test.setTimeout(120_000);
  const { db } = await signIn(BUYER_EMAIL);
  const balance = await db.rpc("points_balance", {
    target_profile: (await db.auth.getUser()).data.user!.id,
  });
  const points = (balance.data as number) ?? 0;

  if (points < 250) {
    const broke = await db.rpc("redeem_reward", { reward: "boost_post", target_post: null });
    expect(
      broke.error?.message.includes("insufficient_points") ||
        broke.error?.message.includes("target_post_required"),
      "an empty balance cannot buy anything",
    ).toBe(true);
  }

  // Someone else's post is never boostable, regardless of balance.
  const seller = await signIn(process.env.E2E_EMAIL!);
  const stamp = Date.now();
  const post = await seller.db
    .from("posts")
    .insert({ author_id: seller.userId, body: `E2E boost target ${stamp}`, posting_as_type: "person" })
    .select("id")
    .single();
  const hijack = await db.rpc("redeem_reward", {
    reward: "boost_post",
    target_post: post.data!.id,
  });
  expect(hijack.error).not.toBeNull();
  expect(
    hijack.error!.message.includes("not_your_post") ||
      hijack.error!.message.includes("insufficient_points"),
  ).toBe(true);

  await seller.db.from("posts").delete().eq("id", post.data!.id);
});

/** The services surface is public and states its vetting position plainly. */
test("services surface is public and does not imply vetting", async ({ page }) => {
  await page.context().clearCookies();
  await page.goto("/services");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("services-notice")).toContainText("has not vetted");
  const shown =
    (await page.getByTestId("services-list").count()) +
    (await page.getByTestId("services-empty").count());
  expect(shown).toBeGreaterThan(0);
});

/** The verification badge helper discloses ids only — never document data. */
test("verification badge lookup returns ids and nothing else", async () => {
  const db = databaseClient();
  const { data, error } = await db.rpc("verified_profile_ids", {
    profile_ids: ["00000000-0000-0000-0000-000000000001"],
  });
  expect(error, "callable anonymously for public badges").toBeNull();
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    expect(Object.keys(row), "only the id is exposed").toEqual(["profile_id"]);
  }
  // The underlying table stays unreadable.
  const direct = await db.from("identity_verifications").select("status,provider_ref");
  expect(direct.data ?? []).toEqual([]);
});
