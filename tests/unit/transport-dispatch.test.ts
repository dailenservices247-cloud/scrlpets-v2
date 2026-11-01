import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { dispatchTransportJob } from "@/lib/transport/dispatch";
import { getCarrierAdapter } from "@/lib/transport/adapters";

vi.mock("@/lib/supabase/anon", () => ({
  createAnonClient: vi.fn(),
}));

import { createAnonClient } from "@/lib/supabase/anon";

describe("transport dispatch system and carrier adapters", () => {
  beforeEach(() => {
    vi.stubEnv("TRANSPORT_DISPATCH_WEBHOOK_URL", "");
    vi.stubEnv("CITIZENSHIPPER_API_KEY", "");
    vi.stubEnv("USHIP_API_KEY", "");
    vi.stubEnv("FLIGHT_NANNY_DISPATCH_URL", "");
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
    vi.stubEnv("TRANSPORT_DISPATCH_WEBHOOK_URL", "https://api.example.com/v1/dispatch");

    const res = await dispatchTransportJob("order-123");
    expect(res.ok).toBe(true);
    expect(res.dispatched).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.example.com/v1/dispatch",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("handles CitizenShipper partner adapter dispatch", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "order-cs-456",
        title_snapshot: "Big Meech Offspring",
        transport_cents: 85000,
        currency: "usd",
        fulfilment: "transported",
        pickup_region: "OH",
        delivery_region: "TX",
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

    vi.stubEnv("CITIZENSHIPPER_API_KEY", "cs_live_test_key_123");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => ({ id: "shipment-999", tracking_url: "https://citizenshipper.com/tracking/999" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const res = await dispatchTransportJob("order-cs-456", "citizenshipper");
    expect(res.ok).toBe(true);
    expect(res.dispatched).toBe(true);
    expect(res.provider).toBe("citizenshipper");
    expect(res.externalJobId).toBe("shipment-999");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.citizenshipper.com/v2/shipments",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer cs_live_test_key_123",
        }),
      }),
    );
  });

  it("handles uShip adapter dispatch", async () => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "order-uship-789",
        title_snapshot: "Oliver Cane Corso Pup",
        transport_cents: 95000,
        currency: "usd",
        fulfilment: "transported",
        pickup_region: "OH",
        delivery_region: "CA",
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

    vi.stubEnv("USHIP_API_KEY", "uship_secret_token_abc");
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ listingNumber: "US-88410", publicUrl: "https://uship.com/listing/US-88410" }),
    });
    vi.stubGlobal("fetch", mockFetch);

    const res = await dispatchTransportJob("order-uship-789", "uship");
    expect(res.ok).toBe(true);
    expect(res.dispatched).toBe(true);
    expect(res.provider).toBe("uship");
    expect(res.externalJobId).toBe("US-88410");
  });

  it("instantiates the correct adapter from provider name", () => {
    expect(getCarrierAdapter("citizenshipper").provider).toBe("citizenshipper");
    expect(getCarrierAdapter("uship").provider).toBe("uship");
    expect(getCarrierAdapter("flight_nanny").provider).toBe("flight_nanny");
    expect(getCarrierAdapter("unknown").provider).toBe("webhook");
  });
});
