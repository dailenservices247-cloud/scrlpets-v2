import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * A valid Stripe signature does not mean a LIVE Stripe event — test-mode
 * endpoints sign test-mode events with their own valid secret. Stripe Identity
 * in test mode accepts synthetic documents, so a test-mode `verified` event
 * reaching production would grant a verified-seller badge for a fake ID, and
 * verified seller is the gate that unlocks animal listings.
 *
 * Production ran on a test key from 2026-07-28 with no such guard. These tests
 * exist so removing it fails loudly rather than silently reopening that.
 */

const SECRET = "whsec_test_secret";

function signed(body: unknown) {
  const payload = JSON.stringify(body);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", SECRET).update(`${t}.${payload}`).digest("hex");
  return new Request("https://example.com/api/webhooks/stripe-identity", {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": `t=${t},v1=${v1}` },
  });
}

function event(livemode: boolean) {
  return {
    type: "identity.verification_session.verified",
    livemode,
    data: { object: { id: "vs_1", metadata: { profile_id: "11111111-1111-1111-1111-111111111111" } } },
  };
}

const rpc = vi.fn().mockResolvedValue({ error: null });
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));

describe("stripe-identity webhook livemode guard", () => {
  const env = process.env;

  beforeEach(() => {
    vi.resetModules();
    rpc.mockClear();
    process.env = {
      ...env,
      STRIPE_IDENTITY_WEBHOOK_SECRET: SECRET,
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    };
  });

  afterEach(() => {
    process.env = env;
  });

  it("refuses a correctly-signed TEST-mode event in production, and writes nothing", async () => {
    process.env.VERCEL_ENV = "production";
    const { POST } = await import("@/app/api/webhooks/stripe-identity/route");

    const res = await POST(signed(event(false)));

    expect(res.status).toBe(400);
    // The write is the part that matters — a 400 with a completed write would
    // still have handed out the badge.
    expect(rpc).not.toHaveBeenCalled();
  });

  it("accepts a live event in production", async () => {
    process.env.VERCEL_ENV = "production";
    const { POST } = await import("@/app/api/webhooks/stripe-identity/route");

    const res = await POST(signed(event(true)));

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalledWith("record_identity_result", expect.objectContaining({
      new_status: "verified",
    }));
  });

  it("still accepts test-mode events outside production, or preview and local are useless", async () => {
    process.env.VERCEL_ENV = "preview";
    const { POST } = await import("@/app/api/webhooks/stripe-identity/route");

    const res = await POST(signed(event(false)));

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalled();
  });
});
