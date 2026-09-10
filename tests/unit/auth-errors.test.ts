import { describe, expect, it } from "vitest";
import {
  authErrorKey,
  isUnknownAccountOtp,
  safeAuthErrorKey,
  safeAuthNoticeKey,
} from "@/lib/auth/errors";

describe("auth errors", () => {
  it("maps provider messages to safe user-facing keys", () => {
    expect(authErrorKey("Invalid login credentials")).toBe(
      "invalid_credentials",
    );
    expect(authErrorKey("Email not confirmed")).toBe("email_not_confirmed");
    expect(authErrorKey("Token has expired")).toBe("link_expired");
    expect(authErrorKey("Too many requests")).toBe("rate_limited");
  });

  it("never lets an unknown-account refusal reach the person typing", () => {
    // With `shouldCreateUser: false`, Supabase refuses an address that has no
    // account. Saying so out loud turns the code box into a membership oracle,
    // so this refusal is swallowed and the same "code sent" screen is shown.
    expect(isUnknownAccountOtp("Signups not allowed for otp")).toBe(true);
    expect(isUnknownAccountOtp("otp_disabled")).toBe(true);
    // It has to DISCRIMINATE. A predicate that answered true for everything
    // would swallow a rate limit as a silent success — the person would sit
    // waiting for an email that was never going to arrive.
    expect(
      isUnknownAccountOtp(
        "For security purposes, you can only request this after 51 seconds",
      ),
    ).toBe(false);
    expect(isUnknownAccountOtp("Token has expired or is invalid")).toBe(false);
    expect(isUnknownAccountOtp("Invalid login credentials")).toBe(false);
  });

  it("rejects arbitrary query-string messages", () => {
    expect(safeAuthErrorKey("provider stack trace")).toBeNull();
    expect(safeAuthNoticeKey("<script>")).toBeNull();
  });
});
