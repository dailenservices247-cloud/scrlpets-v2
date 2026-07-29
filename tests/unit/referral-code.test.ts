import { describe, expect, it } from "vitest";
import { sanitizeReferralCode } from "@/lib/referrals/code";

describe("referral code boundary check", () => {
  it.each([
    ["ab12cd34", "AB12CD34"],
    ["  AB12CD34  ", "AB12CD34"],
    ["ABCD", "ABCD"],
  ])("accepts %s as %s", (raw, expected) => {
    expect(sanitizeReferralCode(raw)).toBe(expected);
  });

  it.each([
    "",
    "   ",
    "abc", // below minimum length
    "A".repeat(33), // above maximum length
    "AB12-CD34", // separator junk
    "AB12CD34%0A", // encoded control characters
    "<script>x</script>",
  ])("refuses %j", (raw) => {
    expect(sanitizeReferralCode(raw)).toBeNull();
  });

  it("refuses non-strings from metadata", () => {
    expect(sanitizeReferralCode(undefined)).toBeNull();
    expect(sanitizeReferralCode(null)).toBeNull();
    expect(sanitizeReferralCode(12345678)).toBeNull();
    expect(sanitizeReferralCode({ code: "AB12CD34" })).toBeNull();
  });
});
