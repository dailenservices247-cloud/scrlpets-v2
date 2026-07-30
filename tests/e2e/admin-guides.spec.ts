import { expect, test } from "@playwright/test";
import { MEMBER_EMAIL, SELLER_EMAIL, signInCached } from "./fixtures";
import { encodeQr, reedSolomon } from "../../src/components/referral/qr";

/**
 * Phase E — admin pack, guides enrichment, referral share.
 *
 * The admin half is written from the OUTSIDE: every test signs in as an
 * ordinary fixture account and proves the platform refuses it. That is the only
 * assertion that can be made honestly on a shared project — there is no
 * standing admin fixture (see moderation-education-records.spec.ts), and a UI
 * that merely hides a button proves nothing about what a direct POST can do.
 */

async function loginViaUi(page: import("@playwright/test").Page, email: string) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
}

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

test.describe("admin pack authority", () => {
  test.describe.configure({ timeout: 120_000 });

  /**
   * Each admin definer refuses a non-admin caller, and each table underneath
   * refuses the same person writing to it directly. Both halves matter: the
   * server action is only safe because the definer refuses, and the definer is
   * only meaningful because the table cannot be written around it.
   */
  test("every admin action is refused for a non-admin, at the database", async () => {
    const { db, userId } = await signInCached(SELLER_EMAIL);

    // Confirms the premise of the whole test: this account is not an admin.
    const admin = await db.rpc("is_platform_admin");
    expect(admin.data).toBe(false);

    // --- the three definers the admin pack calls
    const ticket = await db.rpc("update_support_ticket", {
      target_ticket: NIL_UUID,
      new_status: "resolved",
    });
    expect(ticket.error?.message).toContain("admin_required");

    const redemption = await db.rpc("review_redemption", {
      target_redemption: NIL_UUID,
      decision: "approved",
    });
    expect(redemption.error?.message).toContain("admin_required");

    // resolve_report is the authority behind suspend-with-a-reason, so its
    // refusal is this lane's concern too, not only the moderation lane's.
    const resolve = await db.rpc("resolve_report", {
      target_report: NIL_UUID,
      decision: "account_suspended",
      notes: "e2e should never land",
    });
    expect(resolve.error?.message).toContain("admin_required");

    // --- and the tables, written around the definers
    const forgeSuspension = await db
      .from("account_suspensions")
      .insert({ profile_id: userId, reason: "e2e forged" });
    expect(forgeSuspension.error).not.toBeNull();

    const selfUnsuspend = await db
      .from("account_suspensions")
      .delete({ count: "exact" })
      .eq("profile_id", userId);
    expect(selfUnsuspend.count ?? 0).toBe(0);

    const forgeAudit = await db
      .from("moderation_actions")
      .insert({ actor_id: userId, action: "account_unsuspended" });
    expect(forgeAudit.error).not.toBeNull();

    // No client UPDATE policy on either queue table, so a member cannot resolve
    // their own ticket or approve their own redemption.
    const ticketUpdate = await db
      .from("support_tickets")
      .update({ status: "resolved" }, { count: "exact" })
      .eq("status", "open");
    expect(ticketUpdate.count ?? 0).toBe(0);

    const redemptionUpdate = await db
      .from("redemptions")
      .update({ status: "fulfilled" }, { count: "exact" })
      .eq("profile_id", userId);
    expect(redemptionUpdate.count ?? 0).toBe(0);
  });

  /** The surface itself is not reachable, so the refusals above are the floor. */
  test("/admin is not found for a signed-in non-admin", async ({ page }) => {
    await loginViaUi(page, SELLER_EMAIL);
    const response = await page.goto("/admin");
    expect(response?.status()).toBe(404);
  });
});

test.describe("guide bookmarks are private", () => {
  test.describe.configure({ timeout: 120_000 });

  /**
   * The bookmark row is created by this test and deleted by it — no shared
   * fixture row is borrowed or mutated. The guide it points at is only READ,
   * which is all a published guide is for.
   */
  test("a bookmark is readable, writable and deletable only by its owner", async () => {
    const owner = await signInCached(SELLER_EMAIL);
    const other = await signInCached(MEMBER_EMAIL);

    const guide = await owner.db
      .from("guides")
      .select("id")
      .not("published_at", "is", null)
      .limit(1)
      .maybeSingle();
    test.skip(!guide.data, "no published guide to bookmark");
    const guideId = (guide.data as { id: string }).id;

    const saved = await owner.db
      .from("guide_bookmarks")
      .insert({ profile_id: owner.userId, guide_id: guideId });
    expect(saved.error).toBeNull();

    // The owner sees their own row.
    const mine = await owner.db
      .from("guide_bookmarks")
      .select("guide_id")
      .eq("profile_id", owner.userId)
      .eq("guide_id", guideId);
    expect(mine.data ?? []).toHaveLength(1);

    // Nobody else can see, forge, or remove it. Reading someone else's
    // reading list is the leak this table exists to prevent.
    const peek = await other.db
      .from("guide_bookmarks")
      .select("guide_id")
      .eq("profile_id", owner.userId);
    expect(peek.data ?? []).toEqual([]);

    const forge = await other.db
      .from("guide_bookmarks")
      .insert({ profile_id: owner.userId, guide_id: guideId });
    expect(forge.error).not.toBeNull();

    const steal = await other.db
      .from("guide_bookmarks")
      .delete({ count: "exact" })
      .eq("profile_id", owner.userId)
      .eq("guide_id", guideId);
    expect(steal.count ?? 0).toBe(0);

    const removed = await owner.db
      .from("guide_bookmarks")
      .delete({ count: "exact" })
      .eq("profile_id", owner.userId)
      .eq("guide_id", guideId);
    expect(removed.count).toBe(1);
  });
});

test.describe("guides browse", () => {
  test.describe.configure({ timeout: 120_000 });

  test("the guides surface searches and reports an empty result honestly", async ({ page }) => {
    await page.goto("/guides");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("guides-search-input")).toBeVisible();

    // A query nothing can match must produce the empty state, not the full list.
    await page.goto(`/guides?q=zzq-no-such-guide-${Date.now()}`);
    await expect(page.getByTestId("guides-empty")).toBeVisible();
    await expect(page.getByTestId("guides-list")).toHaveCount(0);

    // A guest is never offered a reading list, because they cannot have one.
    await expect(page.getByTestId("guides-filter-saved")).toHaveCount(0);
  });

  test("a signed-in reader gets a private save control on a guide", async ({ page }) => {
    await loginViaUi(page, SELLER_EMAIL);
    await page.goto("/guides");
    const list = page.getByTestId("guides-list-item");
    test.skip((await list.count()) === 0, "no published guides to render");
    // The control exists for the reader. Nothing on the page reports how many
    // OTHER people saved a guide — there is no such number to render.
    await expect(list.first().getByRole("button")).toBeVisible();
    await expect(page.getByTestId("guides-filter-saved")).toBeVisible();
  });
});

test.describe("referral share", () => {
  test.describe.configure({ timeout: 120_000 });

  /**
   * The QR is generated in-process, so nothing external can be blamed when it
   * stops scanning. These are the checks that fail if it does.
   */
  test("the QR encoder matches the spec and builds a well-formed symbol", () => {
    // The published worked example from the QR specification: "HELLO WORLD" at
    // version 1-Q. A wrong remainder still draws a tidy square that no scanner
    // will read, which is why this vector is pinned rather than eyeballed.
    expect(reedSolomon([32, 91, 11, 120, 209, 114, 220, 77, 67, 64, 236, 17, 236], 13)).toEqual([
      168, 72, 22, 82, 217, 54, 156, 0, 46, 15, 180, 122, 16,
    ]);

    const code = encodeQr("https://scrlpets-v2.vercel.app/signup?ref=AB12CD34");
    expect(code).not.toBeNull();
    const { size, modules, mask } = code!;
    expect(size).toBe(17 + 4 * code!.version);

    const FINDER = [
      [1, 1, 1, 1, 1, 1, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 1, 1, 1, 0, 1],
      [1, 0, 0, 0, 0, 0, 1],
      [1, 1, 1, 1, 1, 1, 1],
    ];
    const finderAt = (r0: number, c0: number) =>
      FINDER.every((row, r) => row.every((v, c) => modules[r0 + r][c0 + c] === (v === 1)));
    expect(finderAt(0, 0), "top-left finder").toBe(true);
    expect(finderAt(0, size - 7), "top-right finder").toBe(true);
    expect(finderAt(size - 7, 0), "bottom-left finder").toBe(true);

    for (let i = 8; i < size - 8; i++) {
      expect(modules[6][i], `row timing at ${i}`).toBe(i % 2 === 0);
      expect(modules[i][6], `column timing at ${i}`).toBe(i % 2 === 0);
    }
    expect(modules[size - 8][8], "dark module").toBe(true);

    // Both copies of the format information must decode back to level L (1)
    // and the mask actually applied. This is what catches a symbol that looks
    // right and reads as gibberish.
    const read = (cells: [number, number][]) =>
      cells.reduce((acc, [r, c], i) => acc | ((modules[r][c] ? 1 : 0) << i), 0);
    const decode = (bits: number) => {
      const d = (bits ^ 0x5412) >>> 10;
      return { ec: d >> 3, mask: d & 7 };
    };
    const copy1: [number, number][] = [
      [0, 8], [1, 8], [2, 8], [3, 8], [4, 8], [5, 8], [7, 8], [8, 8],
      [8, 7], [8, 5], [8, 4], [8, 3], [8, 2], [8, 1], [8, 0],
    ];
    const copy2: [number, number][] = [
      [8, size - 1], [8, size - 2], [8, size - 3], [8, size - 4],
      [8, size - 5], [8, size - 6], [8, size - 7], [8, size - 8],
      [size - 7, 8], [size - 6, 8], [size - 5, 8], [size - 4, 8],
      [size - 3, 8], [size - 2, 8], [size - 1, 8],
    ];
    expect(decode(read(copy1))).toEqual({ ec: 1, mask });
    expect(decode(read(copy2))).toEqual({ ec: 1, mask });

    // Beyond the version-5 ceiling the encoder declines rather than truncating.
    expect(encodeQr("x".repeat(200))).toBeNull();
  });

  test("the share block renders a QR and a message carrying the invite link", async ({ page }) => {
    await loginViaUi(page, SELLER_EMAIL);
    await page.goto("/settings/referrals");
    await expect(page.getByTestId("referral-share")).toBeVisible({ timeout: 20_000 });

    const qr = page.getByTestId("referral-qr");
    await expect(qr).toBeVisible();
    // A path with real geometry, not an empty <svg> shell.
    expect((await qr.locator("path").getAttribute("d"))?.length ?? 0).toBeGreaterThan(100);

    // The message quotes the same link the panel above it shows, so what gets
    // pasted and what gets scanned cannot drift apart.
    const link = await page.getByTestId("referral-link").inputValue();
    expect(link).toContain("/signup?ref=");
    await expect(page.getByTestId("referral-share-text")).toContainText(link);
  });
});
