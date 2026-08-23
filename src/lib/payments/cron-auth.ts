import { timingSafeEqual } from "node:crypto";

/**
 * The cron endpoint's only guard.
 *
 * Same shape as the Stripe signature check in `webhook-handler.ts`: compare in
 * constant time, and length-check first because `timingSafeEqual` throws on
 * mismatched buffers rather than returning false.
 *
 * Fails CLOSED when `CRON_SECRET` is unset. An unconfigured environment must
 * not expose an endpoint that runs refunds and payouts.
 */
export function isAuthorisedCronRequest(authorisation: string | null): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  if (!authorisation?.startsWith("Bearer ")) return false;
  const presented = Buffer.from(authorisation.slice("Bearer ".length));
  const expected = Buffer.from(secret);
  return presented.length === expected.length && timingSafeEqual(presented, expected);
}
