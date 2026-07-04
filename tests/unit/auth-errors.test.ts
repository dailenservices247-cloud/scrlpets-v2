import { describe, expect, it } from "vitest";
import {
  authErrorKey,
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

  it("rejects arbitrary query-string messages", () => {
    expect(safeAuthErrorKey("provider stack trace")).toBeNull();
    expect(safeAuthNoticeKey("<script>")).toBeNull();
  });
});
