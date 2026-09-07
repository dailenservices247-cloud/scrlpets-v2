import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@/lib/payments/webhook-handler";

/**
 * Kept alive and delegating. `/api/webhooks/stripe` is the endpoint to register,
 * but this URL is what production's webhook secret was configured against — and
 * a dead webhook URL is not an error anyone sees, it is events silently dropped
 * on the floor while Stripe retries into nothing.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const { status, body } = await handleStripeWebhook(request, process.env.STRIPE_IDENTITY_WEBHOOK_SECRET);
  return NextResponse.json(body, { status });
}
