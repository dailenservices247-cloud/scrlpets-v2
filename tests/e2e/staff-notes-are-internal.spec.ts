import { expect, test } from "@playwright/test";
import { SELLER_EMAIL, signInCached } from "./fixtures";

/**
 * Staff write notes about members on three tables, and all three let the member
 * read their own row. RLS filters ROWS, not columns, so keeping those notes
 * internal is entirely a matter of column privileges — and a column privilege
 * is invisible from the app, which is how one attempt at this fix
 * (20260730193226) shipped as a silent no-op: `revoke select (col)` cannot
 * subtract from a table-level grant, so Postgres accepted it and changed
 * nothing.
 *
 * These assertions are the thing that would have caught that. They run as a
 * signed-in non-admin, straight against the database, because no UI path is
 * what's protecting these columns.
 */

/** Staff-written or staff-identifying columns, by the table that holds them. */
const INTERNAL = [
  { table: "support_tickets", columns: ["admin_notes"] },
  { table: "redemptions", columns: ["admin_notes", "reviewed_by"] },
  { table: "seller_programs", columns: ["review_notes", "reviewed_by"] },
] as const;

/** What each table must still hand back, so an over-broad revoke also fails. */
const MEMBER_READABLE = [
  { table: "support_tickets", columns: "id,subject,status,created_at" },
  { table: "redemptions", columns: "id,reward_key,points_spent,status,created_at" },
  { table: "seller_programs", columns: "id,program_type,status,created_at" },
] as const;

test("staff notes are not readable by the members they describe", async () => {
  test.setTimeout(120_000);
  const { db } = await signInCached(SELLER_EMAIL);

  // A probe that proves nothing if the fixture happens to be an admin.
  const { data: isAdmin } = await db.rpc("is_platform_admin");
  expect(isAdmin, "fixture must be a non-admin for this spec to mean anything").toBe(false);

  for (const { table, columns } of INTERNAL) {
    for (const column of columns) {
      // 42501 is raised at plan time, so this holds whether or not the fixture
      // owns any rows here — which is the point: it tests the grant, not the data.
      const { error } = await db.from(table).select(`id,${column}`).limit(1);
      expect(error?.code, `${table}.${column} must be revoked from client roles`).toBe("42501");
    }
  }

  for (const { table, columns } of MEMBER_READABLE) {
    const { error } = await db.from(table).select(columns).limit(1);
    expect(error, `${table} lost a column a member is supposed to read`).toBeNull();
  }
});
