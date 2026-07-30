import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import {
  MEMBER_EMAIL,
  MEMBER_PROFILE_ID,
  SELLER_EMAIL,
  THIRD_EMAIL,
  THIRD_PROFILE_ID,
  THIRD_USERNAME,
  signInCached,
} from "./fixtures";

/**
 * Phase D — message requests, attachments, reactions, reciprocal read
 * receipts, and the notification centre (grouping / mark-all-read /
 * clear-all / live-region announcer).
 *
 * ponytail: `conversations` carries a UNIQUE(user_a,user_b) and has no UPDATE
 * or DELETE policy, so a pair's status is a one-way ratchet — a request can be
 * resolved but never re-opened by any client. The request-gate tests therefore
 * consume the MEMBER↔THIRD pair on their first run against a given database
 * and assert the standing invariants (a declined thread is in nobody's main
 * inbox and is not writable) on every run after. Give the fixtures a fourth
 * account, or add a test-only reset, if the create path needs to run every time.
 */

async function signIn(page: Page, email: string) {
  // Cookies first: /login redirects straight back out when a session is still
  // present, which would silently leave the previous account signed in.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
}

async function expectNoSeriousA11y(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter(
    (v) => v.impact === "serious" || v.impact === "critical",
  );
  expect(
    serious,
    JSON.stringify(serious.map((v) => ({ id: v.id, nodes: v.nodes.length })), null, 2),
  ).toEqual([]);
}

function pair(a: string, b: string) {
  const [userA, userB] = [a, b].sort();
  return { userA, userB };
}

test.describe("message requests", () => {
  test("a cold DM from a profile lands as a request, not an active thread", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const { db: memberDb } = await signInCached(MEMBER_EMAIL);
    const { userA, userB } = pair(MEMBER_PROFILE_ID, THIRD_PROFILE_ID);

    const { data: before } = await memberDb
      .from("conversations")
      .select("id,status")
      .eq("user_a", userA)
      .eq("user_b", userB)
      .maybeSingle();
    test.skip(
      before !== null,
      "MEMBER↔THIRD conversation already resolved on this database; the create path is one-shot per pair.",
    );

    await signIn(page, MEMBER_EMAIL);
    await page.goto(`/u/${THIRD_USERNAME}`);
    await page.getByTestId("message-button").click();
    await expect(page).toHaveURL(/\/messages\/[0-9a-f-]+/, { timeout: 20_000 });

    const { data: created } = await memberDb
      .from("conversations")
      .select("id,status,initiated_by")
      .eq("user_a", userA)
      .eq("user_b", userB)
      .single();
    expect(created!.status, "a cold DM must be gated").toBe("request");
    expect(created!.initiated_by, "the knocker is recorded").toBe(MEMBER_PROFILE_ID);

    // The initiator may still write the opener into their own pending request.
    const marker = `E2E cold knock ${Date.now()}`;
    await page.getByTestId("message-input").fill(marker);
    await page.getByTestId("message-send").click();
    await expect(page.getByText(marker)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("thread-pending")).toBeVisible();
  });

  test("a declined request never reaches the recipient's main inbox", async ({
    page,
  }) => {
    test.setTimeout(120_000);
    const { db: memberDb } = await signInCached(MEMBER_EMAIL);
    const { db: thirdDb } = await signInCached(THIRD_EMAIL);
    const { userA, userB } = pair(MEMBER_PROFILE_ID, THIRD_PROFILE_ID);

    const { data: conv } = await memberDb
      .from("conversations")
      .select("id,status,initiated_by")
      .eq("user_a", userA)
      .eq("user_b", userB)
      .maybeSingle();
    test.skip(conv === null, "no MEMBER↔THIRD conversation to resolve.");
    const conversationId = conv!.id as string;

    // The opener body, whatever run created it — asserted absent below.
    const { data: opener } = await memberDb
      .from("messages")
      .select("body")
      .eq("conversation_id", conversationId)
      .order("created_at")
      .limit(1)
      .maybeSingle();

    // One UI sign-in for the whole test: fixtures.ts documents that repeated
    // sign-ins of the same account in quick succession get refused by Supabase
    // auth, and this test previously did two.
    await signIn(page, THIRD_EMAIL);
    await page.goto("/messages");

    if (conv!.status === "request") {
      // The initiator cannot resolve their own knock.
      const selfResolve = await memberDb.rpc("resolve_message_request", {
        target_conversation: conversationId,
        accept: false,
      });
      expect(selfResolve.error?.message).toContain("initiator_cannot_resolve");

      // The addressee declines from the request inbox.
      const card = page
        .getByTestId("message-request")
        .filter({ hasText: opener?.body ?? "" });
      await expect(card).toBeVisible({ timeout: 20_000 });
      await expectNoSeriousA11y(page);
      await card.getByTestId("decline-request").click();
      await expect
        .poll(async () => {
          const { data } = await thirdDb
            .from("conversations")
            .select("status")
            .eq("id", conversationId)
            .single();
          return data?.status;
        }, { timeout: 20_000 })
        .toBe("declined");
    }

    // ---- The invariants, asserted on every run ----
    await page.goto("/messages");

    // Row lookup by conversation id, never by position in a list.
    await expect(
      page.locator(`a[href="/messages/${conversationId}"]`),
      "a declined thread is not in the main inbox",
    ).toHaveCount(0);
    await expect(
      page.getByTestId("message-request"),
      "a declined request is no longer awaiting an answer",
    ).toHaveCount(0);
    if (opener?.body) {
      await expect(
        page.getByText(opener.body),
        "the declined opener body does not leak into the inbox",
      ).toHaveCount(0);
    }

    // And the thread is closed for writing — enforced by the restrictive
    // "request gate on message send" policy, not just by hiding the composer.
    const blocked = await memberDb
      .from("messages")
      .insert({
        conversation_id: conversationId,
        sender_id: MEMBER_PROFILE_ID,
        body: `E2E post-decline send ${Date.now()}`,
      })
      .select("id");
    expect(blocked.error, "declined threads refuse new messages").not.toBeNull();
  });
});

test.describe("thread features", () => {
  /** SELLER↔THIRD, forced active — the surface every feature test below needs. */
  async function activeConversation() {
    const { db: sellerDb, userId: sellerId } = await signInCached(SELLER_EMAIL);
    const { db: thirdDb, userId: thirdId } = await signInCached(THIRD_EMAIL);
    const { userA, userB } = pair(sellerId, thirdId);
    const existing = await sellerDb
      .from("conversations")
      .select("id,status")
      .eq("user_a", userA)
      .eq("user_b", userB)
      .maybeSingle();
    let id = existing.data?.id as string | undefined;
    let status = existing.data?.status as string | undefined;
    if (!id) {
      // A client cannot mint an `active` conversation any more — the
      // "conversation status is earned not declared" restrictive policy refuses
      // it, because being able to declare yourself accepted was how the whole
      // request gate got walked around. So this seeds the real shape: a knock,
      // which the addressee then accepts.
      const created = await sellerDb
        .from("conversations")
        .insert({ user_a: userA, user_b: userB, status: "request", initiated_by: sellerId })
        .select("id")
        .single();
      expect(created.error, "seeding a message request").toBeNull();
      id = created.data!.id as string;
      status = "request";
    }
    if (status !== "active") {
      const accepted = await thirdDb.rpc("resolve_message_request", {
        target_conversation: id,
        accept: true,
      });
      expect(accepted.error, "addressee accepts the request").toBeNull();
    }
    return { id: id!, sellerDb, sellerId, thirdDb, thirdId };
  }

  test("attachments render, reactions persist, and receipts are reciprocal", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const { id, sellerDb, sellerId, thirdDb, thirdId } = await activeConversation();

    // ponytail: the attachment ROW is seeded here rather than uploaded through
    // the picker. The upload itself is src/lib/media/upload.ts, already covered
    // by tests/unit/media-upload.test.ts; what this lane added is the media_url
    // write plus the render, and both are exercised below. Drive the real file
    // picker here if storage ever regresses.
    const marker = `E2E attachment ${Date.now()}`;
    const sent = await sellerDb
      .from("messages")
      .insert({
        conversation_id: id,
        sender_id: sellerId,
        body: marker,
        media_url: "https://example.invalid/e2e-attachment.jpg",
      })
      .select("id")
      .single();
    expect(sent.error).toBeNull();
    const messageId = sent.data!.id as string;

    await signIn(page, SELLER_EMAIL);
    await page.goto(`/messages/${id}`);
    await expect(page.getByText(marker)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId("message-media").first()).toBeVisible();
    // The composer offers the shared media picker rather than a second uploader.
    await expect(page.getByTestId("media-input")).toBeVisible();
    await expectNoSeriousA11y(page);

    // ---- reactions ----
    const row = page.getByTestId("message-row").filter({ hasText: marker }).first();
    await row.getByTestId("message-react-trigger").click();
    await page.getByTestId("message-reaction-love").click();
    await expect(row.getByTestId("message-reaction-count")).toBeVisible({
      timeout: 20_000,
    });
    await expect
      .poll(async () => {
        const { data } = await sellerDb
          .from("message_reactions")
          .select("emoji")
          .eq("message_id", messageId)
          .eq("profile_id", sellerId);
        return data?.[0]?.emoji ?? null;
      }, { timeout: 20_000 })
      .toBe("❤️");

    // ---- read receipts, and the reciprocity rule ----
    await sellerDb.from("profiles").update({ show_read_receipts: true }).eq("id", sellerId);
    await thirdDb.from("profiles").update({ show_read_receipts: true }).eq("id", thirdId);
    await thirdDb.from("conversation_reads").upsert(
      {
        conversation_id: id,
        profile_id: thirdId,
        last_read_at: new Date(Date.now() + 60_000).toISOString(),
      },
      { onConflict: "conversation_id,profile_id" },
    );

    await page.goto(`/messages/${id}`);
    await expect(
      page.getByTestId("read-receipt"),
      "both switches on: the sender sees their message was opened",
    ).toHaveCount(1);

    // Turning MY receipts off must also hide THEIRS from me.
    await page.goto("/messages");
    await page.getByTestId("read-receipts-toggle").uncheck();
    await expect
      .poll(async () => {
        const { data } = await sellerDb
          .from("profiles")
          .select("show_read_receipts")
          .eq("id", sellerId)
          .single();
        return data?.show_read_receipts;
      }, { timeout: 20_000 })
      .toBe(false);

    await page.goto(`/messages/${id}`);
    await expect(
      page.getByTestId("read-receipt"),
      "receipts off: no one-way surveillance — I stop seeing theirs too",
    ).toHaveCount(0);

    // Restore, so the switch is left where the other specs expect it.
    await page.goto("/messages");
    await page.getByTestId("read-receipts-toggle").check();
    await expect
      .poll(async () => {
        const { data } = await sellerDb
          .from("profiles")
          .select("show_read_receipts")
          .eq("id", sellerId)
          .single();
        return data?.show_read_receipts;
      }, { timeout: 20_000 })
      .toBe(true);

    await sellerDb.from("message_reactions").delete().eq("message_id", messageId);
    await sellerDb.from("messages").delete().eq("id", messageId);
  });
});

test.describe("notification centre", () => {
  test("groups repeated actors, marks all read, clears all, and announces", async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const { db: sellerDb, userId: sellerId } = await signInCached(SELLER_EMAIL);
    const { db: memberDb } = await signInCached(MEMBER_EMAIL);
    const { db: thirdDb } = await signInCached(THIRD_EMAIL);

    await sellerDb.rpc("unblock_user", { target_id: MEMBER_PROFILE_ID });
    await sellerDb.rpc("unblock_user", { target_id: THIRD_PROFILE_ID });
    await sellerDb.from("notifications").delete().eq("recipient_id", sellerId);

    const marker = `E2E grouping post ${Date.now()}`;
    const post = await sellerDb
      .from("posts")
      .insert({ author_id: sellerId, content_type: "post", body: marker })
      .select("id")
      .single();
    expect(post.error).toBeNull();
    const postId = post.data!.id as string;

    // Two different actors, same kind, same target → one grouped row.
    await memberDb.from("post_reactions").insert({
      post_id: postId,
      user_id: MEMBER_PROFILE_ID,
      reaction_type: "love",
    });
    await thirdDb.from("post_reactions").insert({
      post_id: postId,
      user_id: THIRD_PROFILE_ID,
      reaction_type: "like",
    });
    await expect
      .poll(async () => {
        const { data } = await sellerDb
          .from("notifications")
          .select("id")
          .eq("recipient_id", sellerId)
          .eq("target_id", postId);
        return data?.length ?? 0;
      }, { timeout: 20_000 })
      .toBe(2);

    await signIn(page, SELLER_EMAIL);
    await page.goto("/notifications");

    // Two notifications, one row — looked up by the target it links to, never
    // by list position.
    await expect(
      page.locator(`a[href="/post/${postId}"]`),
      "repeated actors on one post collapse into a single row",
    ).toHaveCount(1);

    // The announcer is a real live region, present before anything arrives.
    const announcer = page.getByTestId("notification-announcer");
    await expect(announcer).toHaveAttribute("aria-live", "polite");
    await expect(announcer).toHaveAttribute("role", "status");
    await expectNoSeriousA11y(page);

    await page.getByTestId("mark-all-read").click();
    await expect
      .poll(async () => {
        const { count } = await sellerDb
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", sellerId)
          .is("read_at", null);
        return count ?? 0;
      }, { timeout: 20_000 })
      .toBe(0);

    // Clear-all arms before it fires.
    await page.getByTestId("clear-all").click();
    await page.getByTestId("clear-all").click();
    await expect
      .poll(async () => {
        const { count } = await sellerDb
          .from("notifications")
          .select("id", { count: "exact", head: true })
          .eq("recipient_id", sellerId);
        return count ?? 0;
      }, { timeout: 20_000 })
      .toBe(0);
    await expect(page.getByTestId("notifications-empty")).toBeVisible({
      timeout: 20_000,
    });

    await sellerDb.from("post_reactions").delete().eq("post_id", postId);
    await sellerDb.rpc("soft_delete_managed_post", { target_post_id: postId });
  });

  test("a pack invite notification is answerable from the row", async ({ page }) => {
    test.setTimeout(120_000);
    const { db: memberDb, userId: memberId } = await signInCached(MEMBER_EMAIL);
    const { db: thirdDb, userId: thirdId } = await signInCached(THIRD_EMAIL);

    // MEMBER→THIRD: the pack lane's own spec owns the SELLER↔MEMBER pair.
    await memberDb
      .from("pack_links")
      .delete()
      .or(
        `and(requester_id.eq.${memberId},addressee_id.eq.${thirdId}),and(requester_id.eq.${thirdId},addressee_id.eq.${memberId})`,
      );
    const invite = await memberDb
      .from("pack_links")
      .insert({ requester_id: memberId, addressee_id: thirdId })
      .select("id")
      .single();
    expect(invite.error).toBeNull();
    const linkId = invite.data!.id as string;

    await expect
      .poll(async () => {
        const { data } = await thirdDb
          .from("notifications")
          .select("kind")
          .eq("recipient_id", thirdId)
          .eq("target_id", linkId);
        return data?.[0]?.kind ?? null;
      }, { timeout: 20_000 })
      .toBe("pack_invite");

    await signIn(page, THIRD_EMAIL);
    await page.goto("/notifications");
    // The pack lane's exported control, rendered as a sibling of the row link.
    await expect(page.getByTestId(`pack-accept-${linkId}`)).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId(`pack-decline-${linkId}`)).toBeVisible();
    await expectNoSeriousA11y(page);

    await memberDb.from("pack_links").delete().eq("id", linkId);
    await thirdDb.from("notifications").delete().eq("recipient_id", thirdId).eq("target_id", linkId);
  });
});
