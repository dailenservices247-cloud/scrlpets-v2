import { createHmac, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/**
 * Phase 2 / T3: Stripe Identity results arrive here. The signature is verified
 * BEFORE anything is written — an unsigned or stale request can never mark
 * somebody verified. The DB write goes through record_identity_result, which is
 * revoked from anon/authenticated, so this route is the only path in.
 */
export const runtime = "nodejs";

const TOLERANCE_SECONDS = 300;

function verifySignature(payload: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(
    header.split(",").map((kv) => kv.split("=") as [string, string]),
  );
  const timestamp = parts["t"];
  const signature = parts["v1"];
  if (!timestamp || !signature) return false;
  // Reject replays outside the tolerance window.
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > TOLERANCE_SECONDS) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: Request) {
  const secret = process.env.STRIPE_IDENTITY_WEBHOOK_SECRET;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !serviceKey) {
    // Not configured (A1 pending) — refuse rather than pretend.
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const payload = await request.text();
  if (!verifySignature(payload, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "bad_signature" }, { status: 400 });
  }

  const event = JSON.parse(payload) as {
    type: string;
    data: { object: { id: string; metadata?: { profile_id?: string } } };
  };
  const session = event.data.object;
  const profileId = session.metadata?.profile_id;
  if (!profileId) return NextResponse.json({ received: true });

  const status =
    event.type === "identity.verification_session.verified"
      ? "verified"
      : event.type === "identity.verification_session.requires_input"
        ? "failed"
        : event.type === "identity.verification_session.canceled"
          ? "canceled"
          : null;
  if (!status) return NextResponse.json({ received: true });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
  const { error } = await supabase.rpc("record_identity_result", {
    target_profile: profileId,
    session_ref: session.id,
    new_status: status,
  });
  if (error) return NextResponse.json({ error: "write_failed" }, { status: 500 });
  return NextResponse.json({ received: true });
}
