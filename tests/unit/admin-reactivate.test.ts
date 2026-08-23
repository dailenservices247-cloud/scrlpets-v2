import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Undoing a suspension.
 *
 * Nothing called reactivate_account, so suspending was a ONE-WAY DOOR: the only
 * exit was a hand-written statement against production. These pin the two
 * things that make the reverse as accountable as the act — a stated reason, and
 * an admin check that runs before anything else.
 */
const rpc = vi.fn();
const isPlatformAdmin = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: async () => ({ rpc }) }));
vi.mock("@/lib/verification/queries", () => ({ isPlatformAdmin }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const PROFILE = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  isPlatformAdmin.mockResolvedValue(true);
  rpc.mockResolvedValue({ error: null });
});

describe("reactivateAccount", () => {
  it("reactivates for an admin who states a reason", async () => {
    const { reactivateAccount } = await import("@/lib/admin/actions");
    expect(await reactivateAccount(PROFILE, "appeal upheld")).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("reactivate_account", {
      target_profile: PROFILE,
      reason: "appeal upheld",
    });
  });

  it("refuses a too-short reason before calling anything", async () => {
    // The reason lands in moderation_actions. An unsuspension with no stated
    // cause is exactly as unaccountable as a suspension with none.
    const { reactivateAccount } = await import("@/lib/admin/actions");
    expect(await reactivateAccount(PROFILE, "ok")).toEqual({
      ok: false,
      error: "reason_required",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a non-admin before calling anything", async () => {
    isPlatformAdmin.mockResolvedValue(false);
    const { reactivateAccount } = await import("@/lib/admin/actions");
    expect(await reactivateAccount(PROFILE, "appeal upheld")).toEqual({
      ok: false,
      error: "admin_required",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("surfaces not_suspended rather than collapsing it to failed", async () => {
    // An admin pressing reactivate on someone who is not suspended has made a
    // mistake worth naming, not a generic failure.
    rpc.mockResolvedValue({ error: { message: "not_suspended" } });
    const { reactivateAccount } = await import("@/lib/admin/actions");
    expect(await reactivateAccount(PROFILE, "appeal upheld")).toEqual({
      ok: false,
      error: "not_suspended",
    });
  });

  it("collapses anything unexpected to failed, never a raw Postgres message", async () => {
    // AdminError is a CLOSED set because the UI renders it through t(...); a
    // raw message would both miss its key and leak internals into the page.
    rpc.mockResolvedValue({ error: { message: 'relation "x" does not exist' } });
    const { reactivateAccount } = await import("@/lib/admin/actions");
    expect(await reactivateAccount(PROFILE, "appeal upheld")).toEqual({
      ok: false,
      error: "failed",
    });
  });
});
