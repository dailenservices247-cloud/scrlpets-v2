/**
 * Whether this deployment sends a CAPTCHA token with auth calls.
 *
 * ENABLING IS A TWO-PLACE ACT, and the order matters. Supabase enforces CAPTCHA
 * from its dashboard; once enabled there it rejects every auth call without a
 * token, including from a build that is already live. So:
 *
 *   1. deploy this code           (inert — no key, no widget, no token)
 *   2. set NEXT_PUBLIC_TURNSTILE_SITE_KEY  (widget renders, token is sent,
 *                                           Supabase still ignores it)
 *   3. enable CAPTCHA in Supabase Auth      (token now required, and supplied)
 *
 * Doing 3 before 2 is a total authentication outage for every user.
 *
 * Blank counts as absent. A Vercel variable set to "" is an easy mistake, and a
 * widget rendered with an empty sitekey never returns a token — which would
 * lock out every sign-in exactly as if the key were missing, but silently.
 */
export function turnstileSiteKey(): string | null {
  const key = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  return key && key.trim() !== "" ? key : null;
}

export function captchaEnabled(): boolean {
  return turnstileSiteKey() !== null;
}
