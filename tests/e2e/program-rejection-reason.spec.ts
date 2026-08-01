import { expect, test } from "@playwright/test";
import { SELLER_EMAIL, signInCached } from "./fixtures";

/**
 * A rejected applicant used to see `rejected` and nothing else, and the only
 * text explaining why was `review_notes` — which 20260730200412 correctly
 * closed to the person it is written about, because a reviewer who knows the
 * applicant will read their note writes a different note.
 *
 * So the reason is its own column holding a code from a fixed set, translated
 * in the client. Two properties have to hold at once and they pull in opposite
 * directions: the applicant must be able to READ the code, and must not be able
 * to read the note or WRITE the code.
 *
 * Written from the outside, as an ordinary non-admin, for the reason
 * admin-guides.spec.ts gives: there is no standing admin fixture on a shared
 * project. That bounds what is assertable here — a REJECTED row cannot be
 * produced without an admin, so the reviewer's half of the flow (reason
 * required on rejection, cleared on approval, code set enforced by the CHECK)
 * is proven by the migration's own rolled-back probes instead of pretended at.
 *
 * Nothing here inserts a seller_programs row. The table has no DELETE policy —
 * a submission is a permanent record by design — so anything this spec creates
 * it cannot remove, and a spec that leaks a pending row into the admin queue on
 * every run is worse than one that asserts a little less.
 */

test("an applicant can read the reason code but can neither read the note nor write the code", async () => {
  test.setTimeout(120_000);
  const { db, userId } = await signInCached(SELLER_EMAIL);

  // The premise. Everything below is about what a NON-admin can do.
  const { data: isAdmin } = await db.rpc("is_platform_admin");
  expect(isAdmin, "fixture must be a non-admin for this spec to mean anything").toBe(false);

  // READABLE: the whole point of a separate column. 42501 is raised at plan
  // time, so this tests the GRANT rather than whether the fixture owns a row —
  // a column added after 20260730200412's allowlist is not in that allowlist
  // unless the migration says so, and the omission is invisible from the app:
  // getMyTrustState swallows the error and renders an empty program list.
  const readable = await db
    .from("seller_programs")
    .select("id,status,rejection_reason")
    .limit(1);
  expect(readable.error, "the applicant cannot read their own reason code").toBeNull();

  // STILL INTERNAL: the staff note did not come back in through the new
  // feature. This is the assertion that would fail if someone ever "helpfully"
  // widened the allowlist while wiring the reason up.
  const note = await db.from("seller_programs").select("id,review_notes").limit(1);
  expect(note.error?.code, "review_notes leaked back to the applicant").toBe("42501");

  // NOT SELF-WRITABLE, at the only write path a client role has. Before
  // 20260801131000 the insert policy checked profile_id and brand_id and
  // nothing else, so an applicant could submit their own verdict — this exact
  // call inserted a row with status `approved`.
  const selfDecide = await db.from("seller_programs").insert({
    profile_id: userId,
    program_type: "kennel",
    credential_number: `E2E-SELF-${Date.now()}`,
    issuing_authority: "E2E Dept. of Agriculture",
    status: "approved",
  });
  expect(
    selfDecide.error?.code,
    "an applicant decided their own credential",
  ).toBe("42501");

  // Same guard, aimed at the column this change adds: a reason the subject
  // wrote is not a reviewer's decision.
  const selfReason = await db.from("seller_programs").insert({
    profile_id: userId,
    program_type: "kennel",
    credential_number: `E2E-SELF-${Date.now()}`,
    issuing_authority: "E2E Dept. of Agriculture",
    rejection_reason: "other",
  });
  expect(selfReason.error?.code, "an applicant wrote their own reason").toBe("42501");

  // Neither refused insert may have landed.
  const leftovers = await db
    .from("seller_programs")
    .select("id")
    .eq("profile_id", userId)
    .like("credential_number", "E2E-SELF-%");
  expect(leftovers.data ?? [], "a refused insert left a row behind").toHaveLength(0);

  // The decision itself is refused for the subject of it. The target is the nil
  // UUID because admin_required is raised before the row is ever looked up —
  // no row needs to exist, and none is touched.
  const notAdmin = await db.rpc("review_seller_program", {
    target_program: "00000000-0000-0000-0000-000000000000",
    decision: "rejected",
    notes: "internal",
    reason_code: "not_found",
  });
  expect(notAdmin.error?.message).toContain("admin_required");
  // ...and specifically NOT because the four-argument function is missing. A
  // `create or replace` that changes the parameter count creates a SECOND
  // overload rather than replacing, and PGRST202 is what that looks like from
  // here. admin_required proves the new signature is the one being resolved.
  expect(notAdmin.error?.code).not.toBe("PGRST202");
});

/**
 * The wiring. `rejection_reason` joined PROGRAM_COLUMNS, and the render path
 * guards on `status === "rejected" && rejectionReason` — an unguarded
 * t(`rejectionReason.${null}`) would break every non-rejected row on the page.
 * Read-only: it asserts over whatever submissions the fixture already has and
 * creates none.
 */
test("the verification page renders program rows and explains nothing it should not", async ({
  page,
}) => {
  test.setTimeout(180_000);

  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("Email address").fill(SELLER_EMAIL);
  await page.getByLabel("Password").fill(process.env.E2E_PASSWORD!);
  await page.getByTestId("auth-submit").click();
  await expect(page).toHaveURL("http://localhost:3000/", { timeout: 20_000 });

  await page.goto("/settings/verification");
  await expect(page.getByTestId("verification-panel")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId("program-submit")).toBeVisible();

  // Only a rejection carries a reason. Any other status showing one would mean
  // the guard is gone and a stale code is being narrated at people.
  const explained = page.locator(
    '[data-testid="program-row"]:not([data-status="rejected"]) [data-testid="program-rejection-reason"]',
  );
  await expect(explained).toHaveCount(0);
});
