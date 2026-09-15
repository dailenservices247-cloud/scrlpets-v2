import { describe, expect, it } from "vitest";
import { owesSecondFactor, secondFactorExempt } from "@/lib/auth/second-factor";

/**
 * The website half of the sign-in challenge is decided here, so it is a pure
 * function with its own tests — including the case that shaped it: the SDK's
 * no-argument assurance call trusts a factor list the browser can edit.
 */
function token(claims: Record<string, unknown>): string {
  const part = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  return `${part({ alg: "HS256", typ: "JWT" })}.${part(claims)}.signature`;
}

const VERIFIED = [{ status: "verified" }];

describe("owesSecondFactor", () => {
  it("is owed when a verified factor exists and the session is aal1", () => {
    expect(owesSecondFactor(VERIFIED, token({ aal: "aal1" }))).toBe(true);
  });

  it("is settled once the session is aal2", () => {
    expect(owesSecondFactor(VERIFIED, token({ aal: "aal2" }))).toBe(false);
  });

  it("is never owed without a verified factor", () => {
    expect(owesSecondFactor(undefined, token({ aal: "aal1" }))).toBe(false);
    expect(owesSecondFactor([], token({ aal: "aal1" }))).toBe(false);
    // A half-finished enrolment must not trap anyone behind a code they never set up.
    expect(owesSecondFactor([{ status: "unverified" }], token({ aal: "aal1" }))).toBe(false);
  });

  it("fails closed when the token cannot be read", () => {
    expect(owesSecondFactor(VERIFIED, undefined)).toBe(true);
    expect(owesSecondFactor(VERIFIED, "not-a-jwt")).toBe(true);
    expect(owesSecondFactor(VERIFIED, "header.%%%.signature")).toBe(true);
    expect(owesSecondFactor(VERIFIED, token({ sub: "no aal claim" }))).toBe(true);
  });

  it("reads tokens whose claims carry non-ASCII text", () => {
    expect(
      owesSecondFactor(VERIFIED, token({ aal: "aal2", user_metadata: { name: "Zoë" } })),
    ).toBe(false);
  });
});

describe("secondFactorExempt", () => {
  it("lets an owing session reach only the challenge, the callback, sign-out and two static files", () => {
    for (const path of [
      "/two-factor",
      "/auth/callback",
      "/auth/signout",
      "/manifest.webmanifest",
      "/sw.js",
    ]) {
      expect(secondFactorExempt(path), path).toBe(true);
    }
    for (const path of [
      "/",
      "/settings/account",
      "/login",
      "/reset-password",
      "/two-factor/extra",
      "/auth/callback/extra",
    ]) {
      expect(secondFactorExempt(path), path).toBe(false);
    }
  });
});
