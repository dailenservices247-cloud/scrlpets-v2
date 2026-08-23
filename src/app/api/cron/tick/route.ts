import { NextResponse } from "next/server";
import { isAuthorisedCronRequest } from "@/lib/payments/cron-auth";
import { runScheduledJobs } from "@/lib/payments/cron";

/**
 * Everything that has to happen without a human present, on one schedule.
 *
 * Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Thin by design, the
 * same as `api/webhooks/stripe/route.ts` — the logic is testable in
 * `lib/payments/cron.ts` and the auth in `lib/payments/cron-auth.ts`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  if (!isAuthorisedCronRequest(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorised" }, { status: 401 });
  }
  const result = await runScheduledJobs();
  // 200 even with per-job errors: the tick itself succeeded, and the body says
  // what did not. A 500 here would make Vercel retry jobs that already ran.
  return NextResponse.json(result, { status: 200 });
}
