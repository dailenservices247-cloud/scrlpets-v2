import { beforeEach, describe, expect, it } from "vitest";
import { isAuthorisedCronRequest } from "@/lib/payments/cron-auth";

beforeEach(() => {
  process.env.CRON_SECRET = "a-real-secret-value";
});

describe("isAuthorisedCronRequest", () => {
  it("accepts the configured secret as a bearer token", () => {
    expect(isAuthorisedCronRequest("Bearer a-real-secret-value")).toBe(true);
  });

  it("refuses a missing header", () => {
    expect(isAuthorisedCronRequest(null)).toBe(false);
  });

  it("refuses a wrong secret of the SAME length", () => {
    // Same length so the comparison cannot short-circuit on size — this is the
    // case a naive `===` would still pass and a length check alone would miss.
    expect(isAuthorisedCronRequest("Bearer a-real-secret-valuX")).toBe(false);
  });

  it("refuses a wrong secret of a different length", () => {
    expect(isAuthorisedCronRequest("Bearer short")).toBe(false);
  });

  it("refuses the raw secret without the Bearer scheme", () => {
    expect(isAuthorisedCronRequest("a-real-secret-value")).toBe(false);
  });

  it("refuses everything when no secret is configured", () => {
    // Fail CLOSED. An unset secret must not mean an open endpoint that can
    // move money — the opposite default is how cron endpoints get abused.
    delete process.env.CRON_SECRET;
    expect(isAuthorisedCronRequest("Bearer anything")).toBe(false);
    expect(isAuthorisedCronRequest(null)).toBe(false);
  });
});
