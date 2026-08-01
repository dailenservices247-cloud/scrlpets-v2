import { expect, test } from "@playwright/test";
import { MEMBER_EMAIL, SELLER_EMAIL, SELLER_PROFILE_ID, signInCached } from "./fixtures";

/**
 * Standing is earned; balance is spent; they are two different numbers.
 *
 * Legacy computed its Bronze→Diamond ladder from the member's CURRENT POINT
 * BALANCE and paid rewards out of that same balance, so redeeming demoted you.
 * These tests exist to keep the two numbers apart.
 *
 * NOTHING HERE WRITES. Every earning event and every redemption is an
 * append-only ledger row with no client DELETE policy, so a spec that spent
 * points to prove spending is safe would leave a debit on the shared dev
 * database that nobody can take back. The spend-does-not-demote proof lives in
 * the migration's rolled-back probe, where it can be undone. What is asserted
 * here is everything observable without writing: the surface, the refusals, and
 * standing's own algebra.
 *
 * No assertion depends on a NEW i18n string — `messages/*.json` is owned by
 * another lane, so until the block lands every new key renders as its own key
 * path. Copy is asserted through test ids only.
 */

test("standing and balance render as two separate numbers", async ({ page }) => {
  test.setTimeout(120_000);

  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

  await page.goto("/rewards");

  const standingPanel = page.getByTestId("standing-panel");
  const balancePanel = page.getByTestId("balance-panel");
  await expect(standingPanel).toBeVisible({ timeout: 20_000 });
  await expect(balancePanel).toBeVisible();

  // Separate panels, separate numbers — the whole point of the split. A single
  // element carrying both would pass a "shows standing" test and still be the
  // legacy bug.
  const standingText = (await page.getByTestId("standing-points").innerText()).trim();
  const balanceText = (await page.getByTestId("points-balance").innerText()).trim();
  expect(standingText).toMatch(/^\d+$/);
  expect(balanceText).toMatch(/^\d+$/);
  await expect(standingPanel.getByTestId("points-balance")).toHaveCount(0);
  await expect(balancePanel.getByTestId("standing-points")).toHaveCount(0);

  // The rung, its inputs, and the statement that spending cannot cost it.
  await expect(page.getByTestId("standing-tier")).toBeVisible();
  await expect(page.getByTestId("standing-never-falls")).toBeVisible();
  await expect(page.getByTestId("standing-input-handovers")).toBeVisible();
  await expect(page.getByTestId("standing-input-reviews")).toBeVisible();
  await expect(page.getByTestId("standing-input-tenure")).toBeVisible();

  // The ladder is rendered, and so is the fact that no fee is charged from it.
  // Payments are off, so the honesty notice must be present — a page showing a
  // rate it does not charge, without saying so, is the failure mode this whole
  // surface is written against.
  await expect(page.getByTestId("standing-fee-ladder")).toBeVisible();
  await expect(page.getByTestId("fees-not-live")).toBeVisible();

  // Ties the rendered number to the database, and asserts monotonicity while it
  // is at it: another worker may complete a handover for this fixture between
  // the render and this read, so standing may only have gone UP. If standing
  // ever falls, this is where it shows.
  const { db } = await signInCached(SELLER_EMAIL);
  const { data } = await db.rpc("my_standing");
  const now = (data as { standing_points: number }[])[0];
  expect(now.standing_points).toBeGreaterThanOrEqual(Number(standingText));
});

test("standing has no balance term and is not readable for anyone else", async () => {
  test.setTimeout(120_000);
  const { db, userId } = await signInCached(SELLER_EMAIL);

  const { data, error } = await db.rpc("my_standing");
  expect(error, "my_standing is callable by a signed-in member").toBeNull();
  const row = (
    data as {
      handovers: number;
      reviews_received: number;
      tenure_months: number;
      standing_points: number;
      standing_tier: number;
      tier_fee_bps: number;
    }[]
  )[0];
  expect(row, "a signed-in member always has a standing row").toBeTruthy();

  // Reproduced from its own declared parts. Nothing left over means no points
  // total, no balance and no debit leaked into the score. These weights ARE the
  // ruling — if they are retuned, this line moves with the migration.
  expect(row.standing_points).toBe(
    row.handovers * 10 + row.reviews_received * 5 + row.tenure_months,
  );

  // Tenure is capped so it can never carry anyone off the bottom rung on its
  // own: the cap is below the tier-2 threshold.
  expect(row.tenure_months).toBeLessThanOrEqual(12);
  expect(row.standing_tier).toBeGreaterThanOrEqual(1);
  expect(row.standing_tier).toBeLessThanOrEqual(5);
  // The ruled ladder, in basis points. A higher rung is never a worse rate.
  expect([500, 350, 300, 250, 200]).toContain(row.tier_fee_bps);

  // The balance is the OTHER number, and the definer that reads it no longer
  // answers for a stranger. It used to: signed in as the member fixture,
  // points_balance(<seller id>) returned the seller's whole balance, straight
  // past point_ledger's own-rows-only RLS.
  const member = await signInCached(MEMBER_EMAIL);
  const foreign = await member.db.rpc("points_balance", { target_profile: userId });
  expect(foreign.data, "one member cannot read another's balance").toBeNull();
  const own = await member.db.rpc("points_balance", { target_profile: member.userId });
  expect(typeof own.data, "own balance still reads").toBe("number");

  // The targeted standing function is internal — the fee ladder will need a
  // seller's rung while a buyer is the caller, so a client never gets a door
  // that takes an id.
  const targeted = await member.db.rpc("profile_standing", {
    target_profile: SELLER_PROFILE_ID,
  });
  expect(targeted.error, "profile_standing is not callable by a client").not.toBeNull();
});

test("the withdrawn visibility rewards are off the shelf, not merely hidden", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const { db } = await signInCached(SELLER_EMAIL);

  // Disabled, not deleted: redemptions.reward_key is an FK to this table and
  // members already spent points against these keys. Deleting the rows would
  // erase their receipts.
  const { data: rows } = await db
    .from("reward_catalog")
    .select("key,enabled")
    .in("key", ["boost_post", "feature_listing"]);
  expect((rows ?? []).length).toBe(2);
  for (const row of (rows ?? []) as { key: string; enabled: boolean }[]) {
    expect(row.enabled, `${row.key} is withdrawn`).toBe(false);
  }

  // Refused at the database, not merely absent from the page.
  for (const key of ["boost_post", "feature_listing"]) {
    const attempt = await db.rpc("redeem_reward", { reward: key, target_post: null });
    expect(attempt.error?.message, `${key} cannot be bought`).toContain("reward_not_available");
  }

  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

  await page.goto("/rewards");
  await expect(page.getByTestId("reward-catalog")).toBeVisible({ timeout: 20_000 });
  // Not listed at all. A withdrawn reward shown greyed out still advertises it.
  await expect(page.getByTestId("reward-boost_post")).toHaveCount(0);
  await expect(page.getByTestId("reward-feature_listing")).toHaveCount(0);
});

test("the fee credit says plainly that it is not switched on yet", async ({ page }) => {
  test.setTimeout(120_000);
  const { db } = await signInCached(SELLER_EMAIL);

  // Precondition, asserted rather than assumed — commerce.spec.ts pins the same
  // flag and proves no client can flip it.
  const flag = await db
    .from("platform_flags")
    .select("enabled")
    .eq("key", "payments_enabled")
    .single();
  expect(flag.data!.enabled, "payments must still be disabled").toBe(false);

  // The catalogue row is ENABLED. The refusal comes from the payments flag, so
  // switching payments on switches the reward on with no second decision —
  // `reward_not_available` here would mean it went back to being hardcoded off.
  const row = await db
    .from("reward_catalog")
    .select("enabled")
    .eq("key", "fee_credit_10")
    .single();
  expect(row.data!.enabled, "the fee credit tracks the payments flag, not a hardcode").toBe(true);

  const attempt = await db.rpc("redeem_reward", { reward: "fee_credit_10", target_post: null });
  expect(attempt.error?.message).toContain("payments_disabled");

  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

  await page.goto("/rewards");
  await expect(page.getByTestId("reward-fee_credit_10")).toBeVisible({ timeout: 20_000 });
  // Notice shown, and NO button: a control that always fails is a worse lie
  // than saying it is not switched on.
  await expect(page.getByTestId("reward-not-live-fee_credit_10")).toBeVisible();
  await expect(page.getByTestId("reward-redeem-fee_credit_10")).toHaveCount(0);
});
