import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@/lib/payments/webhook-handler";

/**
 * The Stripe destination to register: payments, Connect account updates and
 * identity results all arrive here. One endpoint, one signing secret, one
 * livemode guard.
 *
 * `STRIPE_WEBHOOK_SECRET` is THIS endpoint's secret. It is not set in production
 * yet, because the endpoint registered on 2026-07-28 points at
 * `/api/webhooks/stripe-identity` — so this URL currently answers 503
 * `not_configured`, which is the truth. Register an endpoint here and set the
 * secret Stripe returns; do not borrow the identity endpoint's.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const { status, body } = await handleStripeWebhook(request, process.env.STRIPE_WEBHOOK_SECRET);
  return NextResponse.json(body, { status });
}
