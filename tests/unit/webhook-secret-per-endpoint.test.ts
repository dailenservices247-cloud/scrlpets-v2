import { createHmac } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Stripe signs each webhook ENDPOINT's events with that endpoint's own signing
 * secret. So each route must verify against its own secret and no other.
 *
 * The handler used to resolve one secret for both routes —
 * `STRIPE_WEBHOOK_SECRET ?? STRIPE_IDENTITY_WEBHOOK_SECRET` — which is correct
 * only while a single Stripe endpoint serves both URLs. That is true today
 * (one endpoint, registered 2026-07-28 against /api/webhooks/stripe-identity,
 * two weeks before /api/webhooks/stripe existed), and it stops being true the
 * moment a separate payments endpoint is added in the dashboard. Then every
 * payment event is checked against the identity endpoint's secret, fails, and
 * the fallback is what makes the reason invisible: the symptom is
 * `bad_signature`, which reads as a forged request rather than as the wrong
 * secret for this endpoint.
 *
 * A missing secret must therefore say `not_configured`, not silently verify
 * against a different endpoint's one.
 */

const PAYMENTS_SECRET = "whsec_payments_endpoint";
const IDENTITY_SECRET = "whsec_identity_endpoint";

const PROFILE = "11111111-1111-1111-1111-111111111111";

/** An identity event — both routes handle it, so the route is the only variable. */
const EVENT = {
  type: "identity.verification_session.verified",
  livemode: false,
  data: { object: { id: "vs_1", metadata: { profile_id: PROFILE } } },
};

function signedWith(secret: string, url: string) {
  const payload = JSON.stringify(EVENT);
  const t = Math.floor(Date.now() / 1000);
  const v1 = createHmac("sha256", secret).update(`${t}.${payload}`).digest("hex");
  return new Request(url, {
    method: "POST",
    body: payload,
    headers: { "stripe-signature": `t=${t},v1=${v1}` },
  });
}

const PAYMENTS_URL = "https://example.com/api/webhooks/stripe";
const IDENTITY_URL = "https://example.com/api/webhooks/stripe-identity";

const rpc = vi.fn().mockResolvedValue({ error: null });
vi.mock("@supabase/supabase-js", () => ({ createClient: () => ({ rpc }) }));

describe("each webhook endpoint verifies against its own signing secret", () => {
  const env = process.env;

  beforeEach(() => {
    vi.resetModules();
    rpc.mockClear();
    process.env = {
      ...env,
      SUPABASE_SERVICE_ROLE_KEY: "service-key",
      NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
      VERCEL_ENV: "preview",
    };
    delete process.env.STRIPE_WEBHOOK_SECRET;
    delete process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;
  });

  afterEach(() => {
    process.env = env;
  });

  it("accepts an event signed with the identity endpoint's secret at the identity route", async () => {
    process.env.STRIPE_IDENTITY_WEBHOOK_SECRET = IDENTITY_SECRET;
    const { POST } = await import("@/app/api/webhooks/stripe-identity/route");

    const res = await POST(signedWith(IDENTITY_SECRET, IDENTITY_URL));

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalled();
  });

  it("accepts an event signed with the payments endpoint's secret at the payments route", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = PAYMENTS_SECRET;
    const { POST } = await import("@/app/api/webhooks/stripe/route");

    const res = await POST(signedWith(PAYMENTS_SECRET, PAYMENTS_URL));

    expect(res.status).toBe(200);
    expect(rpc).toHaveBeenCalled();
  });

  /**
   * The hole. With no payments secret configured, the payments route must say
   * so — not borrow the identity endpoint's secret and accept the event.
   */
  it("refuses at the payments route when only the identity secret is configured", async () => {
    process.env.STRIPE_IDENTITY_WEBHOOK_SECRET = IDENTITY_SECRET;
    const { POST } = await import("@/app/api/webhooks/stripe/route");

    const res = await POST(signedWith(IDENTITY_SECRET, PAYMENTS_URL));

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ error: "not_configured" });
    expect(rpc).not.toHaveBeenCalled();
  });

  /** The mirror: the identity route must not be verifiable by the payments secret. */
  it("rejects an event signed with the payments secret at the identity route", async () => {
    process.env.STRIPE_WEBHOOK_SECRET = PAYMENTS_SECRET;
    process.env.STRIPE_IDENTITY_WEBHOOK_SECRET = IDENTITY_SECRET;
    const { POST } = await import("@/app/api/webhooks/stripe-identity/route");

    const res = await POST(signedWith(PAYMENTS_SECRET, IDENTITY_URL));

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "bad_signature" });
    expect(rpc).not.toHaveBeenCalled();
  });
});
