import { describe, expect, it } from "vitest";
import { authSubmitBlocked } from "@/lib/auth/captcha";

/**
 * The gate is tested as a pure function on purpose.
 *
 * CAPTCHA is OFF on the dev project every local run points at, so end-to-end
 * the gate and its inverse are indistinguishable — both let the click through.
 * Only production enforces it, which is the one place a test does not run.
 * Passing `captchaOn` in makes the enforced case reachable here.
 */
describe("auth submit gating", () => {
  it("blocks while a required captcha token is missing", () => {
    expect(authSubmitBlocked(false, true, null)).toBe(true);
    expect(authSubmitBlocked(false, true, "token")).toBe(false);
  });

  it("ignores the token entirely when captcha is off", () => {
    expect(authSubmitBlocked(false, false, null)).toBe(false);
    expect(authSubmitBlocked(false, false, "token")).toBe(false);
  });

  it("blocks while a request is already in flight", () => {
    expect(authSubmitBlocked(true, false, "token")).toBe(true);
    expect(authSubmitBlocked(true, true, "token")).toBe(true);
  });
});
