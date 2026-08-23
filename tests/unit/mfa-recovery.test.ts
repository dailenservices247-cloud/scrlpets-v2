import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Recovery, which is the part of MFA that can lose someone their account.
 *
 * The ordering is the whole security property: the code must be SPENT before
 * the factor is deleted. Deleting first and verifying after would let any
 * authenticated caller strip their own second factor by submitting garbage —
 * which is not recovery, it is a way to turn MFA off from a stolen password
 * session.
 */
const rpc = vi.fn();
const deleteFactor = vi.fn();
const listFactors = vi.fn();
const getUser = vi.fn();

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc, auth: { getUser } }),
}));
vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: { admin: { mfa: { deleteFactor, listFactors } } } }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const USER = "11111111-1111-1111-1111-111111111111";
const FACTOR = "22222222-2222-2222-2222-222222222222";

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-for-tests";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  getUser.mockResolvedValue({ data: { user: { id: USER } } });
  listFactors.mockResolvedValue({ data: { factors: [{ id: FACTOR, status: "verified" }] }, error: null });
  deleteFactor.mockResolvedValue({ data: {}, error: null });
  rpc.mockResolvedValue({ data: true, error: null });
});

describe("recoverWithCode", () => {
  it("spends the code BEFORE deleting the factor", async () => {
    const order: string[] = [];
    rpc.mockImplementation(async () => {
      order.push("consume");
      return { data: true, error: null };
    });
    deleteFactor.mockImplementation(async () => {
      order.push("delete");
      return { data: {}, error: null };
    });
    const { recoverWithCode } = await import("@/lib/mfa/actions");
    expect(await recoverWithCode("abcde-12345")).toEqual({ ok: true });
    expect(order).toEqual(["consume", "delete"]);
  });

  it("deletes NOTHING when the code is wrong", async () => {
    // The one that matters. Otherwise a stolen password session turns MFA off
    // by submitting nonsense.
    rpc.mockResolvedValue({ data: false, error: null });
    const { recoverWithCode } = await import("@/lib/mfa/actions");
    expect(await recoverWithCode("wrong")).toEqual({ ok: false, error: "invalid_code" });
    expect(deleteFactor).not.toHaveBeenCalled();
  });

  it("refuses when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const { recoverWithCode } = await import("@/lib/mfa/actions");
    expect(await recoverWithCode("abcde-12345")).toEqual({ ok: false, error: "auth_required" });
    expect(rpc).not.toHaveBeenCalled();
    expect(deleteFactor).not.toHaveBeenCalled();
  });

  it("refuses when the service role is not configured, rather than half-recovering", async () => {
    // Without the service key the factor cannot be removed. Spending a code and
    // then failing would burn one of ten and leave MFA in place.
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const { recoverWithCode } = await import("@/lib/mfa/actions");
    expect(await recoverWithCode("abcde-12345")).toEqual({ ok: false, error: "not_configured" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("removes every verified factor, not just the first", async () => {
    // Two authenticators enrolled and one left behind is still a locked account.
    listFactors.mockResolvedValue({
      data: { factors: [{ id: "f1", status: "verified" }, { id: "f2", status: "verified" }] },
      error: null,
    });
    const { recoverWithCode } = await import("@/lib/mfa/actions");
    expect(await recoverWithCode("abcde-12345")).toEqual({ ok: true });
    expect(deleteFactor).toHaveBeenCalledTimes(2);
  });
});
