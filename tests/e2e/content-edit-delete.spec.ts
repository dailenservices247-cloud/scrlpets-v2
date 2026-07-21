import { expect, test, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { createClient } from "@supabase/supabase-js";

const RBAC_MEMBER_EMAIL = "scrlpets-rbac-e2e@scrlpets.com";

async function signIn(page: Page) {
  await page.goto("/login");
  await page.getByLabel("Email address").fill(process.env.E2E_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
}

function databaseClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

async function expectNoSeriousA11y(page: Page) {
  await expect(page).toHaveTitle(/\S+/);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();
  const serious = results.violations.filter(
    (violation) =>
      violation.impact === "serious" || violation.impact === "critical",
  );
  expect(
    serious,
    JSON.stringify(
      serious.map((violation) => ({
        id: violation.id,
        nodes: violation.nodes.length,
      })),
      null,
      2,
    ),
  ).toEqual([]);
}

test.describe("content edit/delete", () => {
  test.beforeEach(async ({ page }) => {
    await signIn(page);
  });

  test("owner edits and hard-deletes a post with locked attribution", async ({
    page,
  }) => {
    const original = `E2E editable post ${Date.now()}`;
    const edited = `${original} edited`;

    await page.getByTestId("compose-cta").click();
    await page.getByTestId("post-body").fill(original);
    await page.getByTestId("post-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });

    const card = page.getByTestId("tile-post").filter({ hasText: original });
    // Tolerant: the feed re-render after the post-create redirect is slow under
    // full-suite load; the just-created card still resolves.
    await expect(card.getByTestId("edit-content")).toBeVisible({ timeout: 15_000 });
    await card.getByTestId("edit-content").click();
    await expect(page).toHaveURL(/\/post\/[^/]+\/edit$/);
    const postId = page.url().split("/").at(-2)!;

    await expect(page.getByTestId("locked-attribution")).toHaveAttribute(
      "disabled",
      "",
    );
    await expect(page.getByTestId("edit-post-form")).toBeVisible();
    await expectNoSeriousA11y(page);
    await page.getByTestId("post-body").fill(edited);
    await page.getByTestId("post-submit").click();

    await expect(page).toHaveURL(new RegExp(`/post/${postId}$`));
    await expect(
      page.getByRole("heading", { name: edited, exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("edited-chip")).toBeVisible();

    await page.getByTestId("delete-content").click();
    await expect(page.getByTestId("delete-dialog")).toBeVisible();
    await expectNoSeriousA11y(page);
    await page.keyboard.press("Escape");
    await expect(page.getByTestId("delete-dialog")).toBeHidden();

    await page.getByTestId("delete-content").click();
    await page.getByTestId("confirm-delete").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
    await expect(page.getByText(edited)).toHaveCount(0);

    const db = databaseClient();
    await db.auth.signInWithPassword({
      email: process.env.E2E_EMAIL!,
      password: process.env.E2E_PASSWORD!,
    });
    const { data } = await db.from("posts").select("id").eq("id", postId);
    expect(data).toEqual([]);
  });

  test("owner edits and soft-removes a listing", async ({ page }) => {
    const original = `E2E editable listing ${Date.now()}`;
    const edited = `${original} edited`;

    await page.goto("/compose?mode=listing");
    await page.getByTestId("listing-title").fill(original);
    await page.getByTestId("listing-price").fill("123.45");
    await page.getByTestId("listing-submit").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });

    const card = page.getByTestId("tile-listing").filter({ hasText: original });
    await expect(card.getByTestId("edit-content")).toBeVisible({ timeout: 15_000 });
    await card.getByTestId("edit-content").click();
    await expect(page).toHaveURL(/\/listing\/[^/]+\/edit$/);
    const listingId = page.url().split("/").at(-2)!;

    await expect(page.getByTestId("locked-attribution")).toHaveAttribute(
      "disabled",
      "",
    );
    await page.getByTestId("listing-title").fill(edited);
    await page.getByTestId("listing-price").fill("150.00");
    await page.getByTestId("listing-submit").click();

    await expect(page).toHaveURL(new RegExp(`/listing/${listingId}$`));
    await expect(
      page.getByRole("heading", { name: edited, exact: true }),
    ).toBeVisible();
    await expect(page.getByTestId("edited-chip")).toBeVisible();

    const db = databaseClient();
    await db.auth.signInWithPassword({
      email: process.env.E2E_EMAIL!,
      password: process.env.E2E_PASSWORD!,
    });
    const { data: beforeDelete } = await db
      .from("listings")
      .select("title,price_cents")
      .eq("id", listingId)
      .single();
    expect(beforeDelete).toEqual({ title: edited, price_cents: 15000 });

    await page.getByTestId("delete-content").click();
    await expect(page.getByText("Remove this listing?")).toBeVisible();
    await page.getByTestId("confirm-delete").click();
    await expect(page).toHaveURL("http://localhost:3000/", { timeout: 15_000 });
    await expect(page.getByText(edited)).toHaveCount(0);

    const { data: hiddenBaseRow } = await db
      .from("listings")
      .select("id")
      .eq("id", listingId);
    expect(hiddenBaseRow).toEqual([]);
    const { data: hiddenFeedRow } = await db
      .from("unified_feed")
      .select("id")
      .eq("id", listingId);
    expect(hiddenFeedRow).toEqual([]);
  });

  test("guest sees no owner controls", async ({ page }) => {
    const marker = `E2E guest-controls post ${Date.now()}`;

    await page.getByTestId("compose-cta").click();
    await page.getByTestId("post-body").fill(marker);
    await page.getByTestId("post-submit").click();
    const card = page.getByTestId("tile-post").filter({ hasText: marker });
    await expect(card.getByTestId("edit-content")).toBeVisible({ timeout: 15_000 });
    const editHref = await card.getByTestId("edit-content").getAttribute("href");
    const postId = editHref!.split("/").at(-2)!;

    await page.context().clearCookies();
    await page.goto(`/post/${postId}`);
    // Heading role only: Next streams <title> into the body, so getByText(marker)
    // intermittently strict-mode-collides with the document title.
    await expect(page.getByRole("heading", { name: marker })).toBeVisible();
    await expect(page.getByTestId("edit-content")).toHaveCount(0);
    await expect(page.getByTestId("delete-content")).toHaveCount(0);

    await signIn(page);
    await page.goto(`/post/${postId}`);
    await page.getByTestId("delete-content").click();
    await page.getByTestId("confirm-delete").click();
  });

  test("RLS blocks non-author writes and trigger blocks attribution rewrites", async () => {
    const db = databaseClient();
    const { data: auth, error: authError } = await db.auth.signInWithPassword({
      email: process.env.E2E_EMAIL!,
      password: process.env.E2E_PASSWORD!,
    });
    expect(authError).toBeNull();
    const userId = auth.user!.id;

    const otherDb = databaseClient();
    const { data: otherAuth, error: otherAuthError } =
      await otherDb.auth.signInWithPassword({
        email: RBAC_MEMBER_EMAIL,
        password: process.env.E2E_PASSWORD!,
      });
    expect(otherAuthError).toBeNull();
    const otherMarker = `E2E non-author personal post ${Date.now()}`;
    const { data: other, error: otherInsertError } = await otherDb
      .from("posts")
      .insert({
        author_id: otherAuth.user!.id,
        content_type: "post",
        body: otherMarker,
      })
      .select("id,body")
      .single();
    expect(otherInsertError).toBeNull();

    const { data: blocked } = await db
      .from("posts")
      .update({ body: "E2E forbidden rewrite" })
      .eq("id", other!.id)
      .select("id");
    expect(blocked).toEqual([]);
    const { data: unchanged } = await db
      .from("posts")
      .select("body")
      .eq("id", other!.id)
      .single();
    expect(unchanged!.body).toBe(other!.body);

    const marker = `E2E trigger post ${Date.now()}`;
    const { data: own, error: insertError } = await db
      .from("posts")
      .insert({ author_id: userId, content_type: "post", body: marker })
      .select("id,posting_as_type,about_type")
      .single();
    expect(insertError).toBeNull();

    const { error: immutableError } = await db
      .from("posts")
      .update({ about_type: "service" })
      .eq("id", own!.id);
    expect(immutableError?.message).toContain("immutable");

    const { data: after } = await db
      .from("posts")
      .select("posting_as_type,about_type")
      .eq("id", own!.id)
      .single();
    expect(after).toEqual({
      posting_as_type: own!.posting_as_type,
      about_type: own!.about_type,
    });

    await db.from("posts").delete().eq("id", own!.id);
    await otherDb.from("posts").delete().eq("id", other!.id);
  });
});
