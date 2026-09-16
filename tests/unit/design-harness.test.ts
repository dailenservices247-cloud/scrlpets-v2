import { describe, expect, it } from "vitest";
import { designHarnessEnabled } from "@/lib/design/harness";

describe("designHarnessEnabled", () => {
  it("is on when the flag is set, even in a production build", () => {
    expect(designHarnessEnabled({ NODE_ENV: "production", DESIGN_HARNESS: "1" })).toBe(true);
  });

  it("is on in development without the flag", () => {
    expect(designHarnessEnabled({ NODE_ENV: "development" })).toBe(true);
  });

  it("is OFF in a production build with no flag — this is what protects scrlpets.com", () => {
    expect(designHarnessEnabled({ NODE_ENV: "production" })).toBe(false);
  });

  it("treats any value other than 1 as off", () => {
    expect(designHarnessEnabled({ NODE_ENV: "production", DESIGN_HARNESS: "true" })).toBe(false);
  });
});
