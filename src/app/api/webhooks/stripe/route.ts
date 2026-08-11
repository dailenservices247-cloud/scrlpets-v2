import { NextResponse } from "next/server";
import { handleStripeWebhook } from "@/lib/payments/webhook-handler";

/**
 * The Stripe destination to register: payments, Connect account updates and
 * identity results all arrive here. One endpoint, one signing secret, one
 * livemode guard.
 */
export const runtime = "nodejs";

export async function POST(request: Request) {
  const { status, body } = await handleStripeWebhook(request);
  return NextResponse.json(body, { status });
}
