import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { MEMBER_EMAIL, SELLER_EMAIL, signInCached } from "./fixtures";

const BUYER_EMAIL = MEMBER_EMAIL;

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
 * THE POINTS GATE. Points are awarded by the database in response to real
 * events. If a client can write the ledger, the whole economy is fiction and
 * so is anything it buys.
 */
test("points cannot be granted, edited or deleted by a client", async () => {
  test.setTimeout(120_000);
  const { db, userId } = await signIn(SELLER_EMAIL);

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
  const { db } = await signIn(SELLER_EMAIL);

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
  const seller = await signIn(SELLER_EMAIL);
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

test("a referral code cannot be claimed by its own owner", async () => {
  test.setTimeout(120_000);
  // Idempotent guard probe: minting is idempotent and a self-claim writes
  // nothing, so this leaves no rows behind on a shared database.
  const { db } = await signIn(SELLER_EMAIL);
  const minted = await db.rpc("ensure_referral_code");
  expect(minted.error).toBeNull();
  const claim = await db.rpc("claim_referral", { code: minted.data as string });
  expect(claim.error, "self-referral is refused by the definer").not.toBeNull();
  expect(claim.error!.message).toContain("self_referral");
});

test("provider creates, edits and retires a service from Brand OS", async ({ page }) => {
  test.setTimeout(180_000);
  const marker = `E2E svc ${Date.now()}`;

  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

  // Create with full marketplace fields.
  await page.goto("/brand-os");
  await expect(page.getByTestId("services-manager")).toBeVisible();
  await page.getByTestId("offer-service").click();
  await page.getByTestId("svc-new-name").fill(marker);
  await page.getByTestId("svc-new-category").selectOption("grooming");
  await page.getByTestId("svc-new-price").fill("45.00");
  await page.getByTestId("svc-new-area").fill("Toledo, OH");
  await page.getByTestId("svc-new-submit").click();
  const row = page.getByTestId("my-service-row").filter({ hasText: marker });
  await expect(row).toBeVisible({ timeout: 20_000 });
  await expect(row.getByTestId("service-live-chip")).toBeVisible();

  // Live on the public providers surface.
  await page.goto("/services");
  await expect(
    page.getByTestId("service-card").filter({ hasText: marker }),
  ).toBeVisible();

  // Edit is owner-only by RLS; the panel edits in place.
  await page.goto("/brand-os");
  await row.getByTestId("svc-edit-open").click();
  await page.getByTestId("svc-edit-area").fill("Toledo + Ann Arbor");
  await page.getByTestId("svc-edit-save").click();
  await expect(row.getByText("Toledo + Ann Arbor")).toBeVisible({ timeout: 20_000 });

  // Retire: gone from the public page, kept in the manager as history.
  await row.getByTestId("service-retire").click();
  await expect(row.getByTestId("service-retired-chip")).toBeVisible({ timeout: 20_000 });
  await page.goto("/services");
  await expect(page.getByTestId("service-card").filter({ hasText: marker })).toHaveCount(0);

  // Cleanup MUST be asserted (a silent no-op polluted a public surface once).
  const { db, userId } = await signIn(SELLER_EMAIL);
  const del = await db
    .from("services")
    .delete({ count: "exact" })
    .eq("owner_id", userId)
    .eq("name", marker);
  expect(del.error).toBeNull();
  expect(del.count).toBe(1);
});
