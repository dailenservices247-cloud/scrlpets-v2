import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The admin shipment queue.
 *
 * `confirm_shipment_delivered` has NO caller check in the database — no uid, no
 * admin test. Its entire authorization is that it is revoked from every client
 * role. A server action holding the service role therefore bypasses everything,
 * and the isPlatformAdmin() call below is not defence in depth: it is the only
 * defence that exists. That is what these tests are for.
 */
const isPlatformAdmin = vi.fn();
vi.mock("@/lib/verification/queries", () => ({ isPlatformAdmin }));

const rpc = vi.fn();
const createClient = vi.fn(() => ({ rpc }));
vi.mock("@supabase/supabase-js", () => ({ createClient }));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const ORDER = "11111111-1111-1111-1111-111111111111";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-key-for-tests";
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  rpc.mockResolvedValue({ data: [], error: null });
});

describe("confirmShipmentDelivered", () => {
  it("refuses a non-admin BEFORE building a service-role client", async () => {
    // Order matters. Building the client first and checking after would mean a
    // bug in the check leaves a fully-privileged handle already constructed.
    isPlatformAdmin.mockResolvedValue(false);
    const { confirmShipmentDelivered } = await import("@/lib/admin/shipments");
    const result = await confirmShipmentDelivered(ORDER);
    expect(result).toEqual({ ok: false, error: "not_admin" });
    expect(createClient).not.toHaveBeenCalled();
    expect(rpc).not.toHaveBeenCalled();
  });

  it("calls the definer for an admin", async () => {
    isPlatformAdmin.mockResolvedValue(true);
    rpc.mockResolvedValue({ data: null, error: null });
    const { confirmShipmentDelivered } = await import("@/lib/admin/shipments");
    const result = await confirmShipmentDelivered(ORDER);
    expect(result).toEqual({ ok: true });
    expect(rpc).toHaveBeenCalledWith("confirm_shipment_delivered", { target_order: ORDER });
  });

  it("returns the definer's refusal verbatim", async () => {
    isPlatformAdmin.mockResolvedValue(true);
    rpc.mockResolvedValue({ data: null, error: { message: "not_dispatched" } });
    const { confirmShipmentDelivered } = await import("@/lib/admin/shipments");
    expect(await confirmShipmentDelivered(ORDER)).toEqual({ ok: false, error: "not_dispatched" });
  });
});

describe("getOverdueShipments", () => {
  it("refuses a non-admin", async () => {
    isPlatformAdmin.mockResolvedValue(false);
    const { getOverdueShipments } = await import("@/lib/admin/shipments");
    expect(await getOverdueShipments()).toEqual([]);
    expect(createClient).not.toHaveBeenCalled();
  });

  it("returns the rows for an admin", async () => {
    isPlatformAdmin.mockResolvedValue(true);
    rpc.mockResolvedValue({
      data: [
        {
          order_id: ORDER,
          shipped_at: "2026-08-01T00:00:00Z",
          carrier: "UPS",
          tracking_number: "1Z999",
        },
      ],
      error: null,
    });
    const { getOverdueShipments } = await import("@/lib/admin/shipments");
    const rows = await getOverdueShipments();
    expect(rows).toHaveLength(1);
    expect(rows[0].carrier).toBe("UPS");
  });
});
