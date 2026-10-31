import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { dispatchTransportJob } from "@/lib/transport/dispatch";

vi.mock("@/lib/supabase/anon", () => ({
  createAnonClient: vi.fn(),
}));

import { createAnonClient } from "@/lib/supabase/anon";

describe("transport dispatch system", () => {
  beforeEach(() => {
    vi.stubEnv("TRANSPORT_DISPATCH_WEBHOOK_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns not found for nonexistent order", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(createAnonClient).mockReturnValue({
      from: mockFrom,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await dispatchTransportJob("nonexistent-order");
    expect(res.ok).toBe(false);
    expect(res.message).toContain("Order not found");
  });

  it("gracefully records readiness when no webhook URL is configured", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "order-123",
        title_snapshot: "Champion Cane Corso Puppy",
        transport_cents: 65000,
        currency: "usd",
        fulfilment: "transported",
        pickup_region: "OH",
        delivery_region: "FL",
        status: "funds_held",
      },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(createAnonClient).mockReturnValue({
      from: mockFrom,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const res = await dispatchTransportJob("order-123");
    expect(res.ok).toBe(true);
    expect(res.dispatched).toBe(false);
    expect(res.message).toContain("awaiting carrier webhook configuration");
  });

  it("successfully dispatches payload to configured 3rd-party webhook", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "order-123",
        title_snapshot: "Champion Cane Corso Puppy",
        transport_cents: 65000,
        currency: "usd",
        fulfilment: "transported",
        pickup_region: "OH",
        delivery_region: "FL",
        status: "funds_held",
      },
      error: null,
    });
    const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
    const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
    const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });

    vi.mocked(createAnonClient).mockReturnValue({
      from: mockFrom,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal("fetch", mockFetch);
    vi.stubEnv("TRANSPORT_DISPATCH_WEBHOOK_URL", "https://api.citizenshipper.com/v1/dispatch");

    const res = await dispatchTransportJob("order-123");
    expect(res.ok).toBe(true);
    expect(res.dispatched).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.citizenshipper.com/v1/dispatch",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });
});
