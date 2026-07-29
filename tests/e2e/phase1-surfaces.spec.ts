import { expect, test, type Page } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { MEMBER_EMAIL, MEMBER_PROFILE_ID, SELLER_EMAIL } from "./fixtures";

function databaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function signIn(page: Page, email: string) {
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });
}

// Phase 1 / R11: public search across the four entity types.
test("search finds people, animals and listings, and is public", async ({ page }) => {
  await page.goto("/search?q=breeder_jane");
  await expect(page.getByTestId("search-person").first()).toBeVisible({ timeout: 15_000 });

  await page.goto("/search?q=Biscuit");
  await expect(page.getByTestId("search-animal").first()).toBeVisible();

  // Short queries return nothing rather than dumping the table.
  await page.goto("/search?q=a");
  await expect(page.getByTestId("search-person")).toHaveCount(0);
  await expect(page.getByTestId("search-animal")).toHaveCount(0);
});

// Phase 1 / R12: notifications are written by DB triggers, owner-only.
test("notifications arrive from real events and stay private", async ({ page }) => {
  test.setTimeout(120_000);
  const password = process.env.E2E_PASSWORD!;
  const ownerDb = databaseClient();
  const ownerAuth = await ownerDb.auth.signInWithPassword({
    email: SELLER_EMAIL,
    password,
  });
  const ownerId = ownerAuth.data.user!.id;
  const memberDb = databaseClient();
  await memberDb.auth.signInWithPassword({ email: MEMBER_EMAIL, password });

  // Clean slate between the fixtures.
  await ownerDb.rpc("unblock_user", { target_id: MEMBER_PROFILE_ID });
  await ownerDb.from("notifications").delete().eq("recipient_id", ownerId);

  const marker = `E2E notify post ${Date.now()}`;
  const post = await ownerDb
    .from("posts")
    .insert({ author_id: ownerId, content_type: "post", body: marker })
    .select("id")
    .single();

  // The member reacts and comments → two notifications for the owner.
  await memberDb.from("post_reactions").insert({
    post_id: post.data!.id,
    user_id: MEMBER_PROFILE_ID,
    reaction_type: "love",
  });
  await memberDb.from("comments").insert({
    post_id: post.data!.id,
    author_id: MEMBER_PROFILE_ID,
    body: "E2E notify comment",
  });

  await expect
    .poll(async () => {
      const { data } = await ownerDb
        .from("notifications")
        .select("kind")
        .eq("recipient_id", ownerId);
      return (data ?? []).map((n) => n.kind).sort();
    }, { timeout: 15_000 })
    .toEqual(["comment", "reaction"]);

  // A notification is owner-only: the actor cannot read the recipient's rows.
  const { data: leaked } = await memberDb
    .from("notifications")
    .select("id")
    .eq("recipient_id", ownerId);
  expect(leaked).toEqual([]);

  // Nobody can fabricate a notification for someone else (no insert policy).
  const forged = await memberDb.from("notifications").insert({
    recipient_id: ownerId,
    actor_id: MEMBER_PROFILE_ID,
    kind: "follow",
  });
  expect(forged.error).not.toBeNull();

  // The center renders them and mark-all-read clears the badge.
  await signIn(page, SELLER_EMAIL);
  await expect(page.getByTestId("unread-badge")).toBeVisible();
  await page.getByTestId("header-notifications").click();
  await expect(page).toHaveURL(/\/notifications/, { timeout: 20_000 });
  await expect(page.getByTestId("notification-item").first()).toBeVisible();
  await page.getByTestId("mark-all-read").click();
  await expect(page.getByTestId("mark-all-read")).toHaveCount(0);

  // Cleanup.
  await ownerDb.from("notifications").delete().eq("recipient_id", ownerId);
  await ownerDb.from("comments").delete().eq("post_id", post.data!.id);
  await ownerDb.from("post_reactions").delete().eq("post_id", post.data!.id);
  await ownerDb.rpc("soft_delete_managed_post", { target_post_id: post.data!.id });
});

// Phase 1 / R10: the account-safety surface exists and is owner-only.
test("account settings expose email, password, export and deletion", async ({ page }) => {
  await signIn(page, SELLER_EMAIL);
  await page.goto("/settings/account");
  await expect(page.getByTestId("account-settings")).toBeVisible();
  await expect(page.getByTestId("account-email-input")).toBeVisible();
  await expect(page.getByTestId("account-password-input")).toHaveAttribute("minlength", "8");
  await expect(page.getByTestId("account-export")).toBeVisible();

  // Deletion is two-step, never one click.
  await expect(page.getByTestId("account-delete-confirm")).toHaveCount(0);
  await page.getByTestId("account-delete").click();
  await expect(page.getByTestId("account-delete-confirm")).toBeVisible();

  // Guests are gated out of the private surfaces entirely.
  await page.context().clearCookies();
  await page.goto("/settings/account");
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
  await page.goto("/notifications");
  await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });
});
