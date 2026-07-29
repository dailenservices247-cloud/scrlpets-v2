/**
 * A referral code travels through URLs and auth metadata before it reaches
 * claim_referral, so it gets one shape check at the boundary. The definer
 * uppercases and re-validates; this only refuses obvious junk and bounds the
 * length so nothing pathological rides the signup flow.
 */
export function sanitizeReferralCode(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const code = raw.trim().toUpperCase();
  return /^[A-Z0-9]{4,32}$/.test(code) ? code : null;
}
