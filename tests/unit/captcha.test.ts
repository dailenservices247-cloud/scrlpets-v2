import { afterEach, describe, expect, it } from "vitest";
import { captchaEnabled, turnstileSiteKey } from "@/lib/auth/captcha";

/**
 * CAPTCHA is switched on in the SUPABASE DASHBOARD, not here. Once it is on,
 * Supabase rejects every auth call that arrives without a token — including
 * from an already-deployed build.
 *
 * So the only safe order is: ship the code, add the key, THEN flip the
 * dashboard. These pin that the code path is genuinely inert without a key,
 * because "inert" is what makes that order survivable.
 */
const original = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

afterEach(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = original;
});

describe("captchaEnabled", () => {
  it("is off when no site key is configured", () => {
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    expect(captchaEnabled()).toBe(false);
    expect(turnstileSiteKey()).toBeNull();
  });

  it("is off for an empty or whitespace key, not merely undefined", () => {
    // A Vercel env var set to "" is a very easy mistake, and it must not read
    // as configured — a widget rendered with an empty sitekey never returns a
    // token, which locks out every sign-in.
    for (const blank of ["", "   "]) {
      process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = blank;
      expect(captchaEnabled()).toBe(false);
      expect(turnstileSiteKey()).toBeNull();
    }
  });

  it("is on once a real key is present", () => {
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = "0x4AAAAAAA_example";
    expect(captchaEnabled()).toBe(true);
    expect(turnstileSiteKey()).toBe("0x4AAAAAAA_example");
  });
});
