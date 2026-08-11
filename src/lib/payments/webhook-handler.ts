import { createHmac, timingSafeEqual } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

/**
 * One handler for every Stripe event this platform cares about, so there is one
 * signature check and one livemode guard rather than a set that drift apart.
 *
 * Two routes call it — `/api/webhooks/stripe` (the one to register) and the
 * original `/api/webhooks/stripe-identity`, which stays alive because its secret
 * is already configured in production and a dead URL is a silently dropped event.
 */

const TOLERANCE_SECONDS = 300;

/** Prefer the general name; fall back so an already-configured prod keeps working. */
function webhookSecret(): string | undefined {
  return process.env.STRIPE_WEBHOOK_SECRET ?? process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;
}

export function verifySignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((kv) => kv.split("=") as [string, string]));
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

type StripeEvent = {
  type: string;
  livemode?: boolean;
  data: {
    object: {
      id: string;
      amount_received?: number;
      amount?: number;
      metadata?: Record<string, string>;
      charges_enabled?: boolean;
      payouts_enabled?: boolean;
      details_submitted?: boolean;
      requirements?: { currently_due?: string[] };
    };
  };
};

export type WebhookOutcome = { status: number; body: Record<string, unknown> };

export async function handleStripeWebhook(request: Request): Promise<WebhookOutcome> {
  const secret = webhookSecret();
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !serviceKey) {
    return { status: 503, body: { error: "not_configured" } };
  }

  const payload = await request.text();
  if (!verifySignature(payload, request.headers.get("stripe-signature"), secret)) {
    return { status: 400, body: { error: "bad_signature" } };
  }

  const event = JSON.parse(payload) as StripeEvent;

  /**
   * A valid signature proves the event came from Stripe. It does NOT prove it
   * came from the LIVE Stripe — a test-mode endpoint signs test-mode events with
   * its own perfectly valid secret.
   *
   * This mattered for identity (test-mode Identity accepts synthetic documents,
   * so a test event would hand out a verified badge for a fake ID). It matters
   * MORE here: a test-mode `payment_intent.succeeded` would book real money as
   * captured against a real order, and the animal would ship against a payment
   * that does not exist.
   */
  if (process.env.VERCEL_ENV === "production" && event.livemode !== true) {
    return { status: 400, body: { error: "test_mode_event_in_production" } };
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
  const object = event.data.object;

  // ---------------------------------------------------------------- payments
  if (event.type === "payment_intent.succeeded") {
    const orderId = object.metadata?.order_id;
    const kind = object.metadata?.payment_kind;
    // Stripe reports what it actually captured. Trusting a metadata amount would
    // let a crafted intent book more than was paid.
    const amount = object.amount_received ?? object.amount;
    if (!orderId || !kind || !amount) return { status: 200, body: { received: true, ignored: "missing_metadata" } };

    const { error } = await supabase.rpc("record_order_payment", {
      target_order: orderId,
      payment_kind: kind,
      amount,
      payment_intent_id: object.id,
    });
    // record_order_payment is idempotent on the intent id, so a redelivery
    // returns the existing row rather than double-booking.
    if (error) return { status: 500, body: { error: "payment_write_failed" } };
    return { status: 200, body: { received: true } };
  }

  // ------------------------------------------------------------- connect
  if (event.type === "account.updated") {
    const profileId = object.metadata?.profile_id;
    if (!profileId) return { status: 200, body: { received: true, ignored: "no_profile" } };

    const { error } = await supabase.rpc("upsert_payout_account", {
      target_profile: profileId,
      account_id: object.id,
      charges: Boolean(object.charges_enabled),
      payouts: Boolean(object.payouts_enabled),
      submitted: Boolean(object.details_submitted),
      requirements: object.requirements?.currently_due ?? [],
    });
    if (error) return { status: 500, body: { error: "account_write_failed" } };
    return { status: 200, body: { received: true } };
  }

  // ------------------------------------------------------------ identity
  const identityStatus =
    event.type === "identity.verification_session.verified"
      ? "verified"
      : event.type === "identity.verification_session.requires_input"
        ? "failed"
        : event.type === "identity.verification_session.canceled"
          ? "canceled"
          : null;

  if (identityStatus) {
    const profileId = object.metadata?.profile_id;
    if (!profileId) return { status: 200, body: { received: true, ignored: "no_profile" } };
    const { error } = await supabase.rpc("record_identity_result", {
      target_profile: profileId,
      session_ref: object.id,
      new_status: identityStatus,
    });
    if (error) return { status: 500, body: { error: "write_failed" } };
    return { status: 200, body: { received: true } };
  }

  // An unrecognised event is acknowledged, not failed — returning non-2xx makes
  // Stripe retry something this app will never handle.
  return { status: 200, body: { received: true } };
}
