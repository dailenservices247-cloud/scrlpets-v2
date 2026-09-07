import { describe, expect, it } from "vitest";
import { settleAction } from "@/lib/actions/settle";

/**
 * Every form in this app awaits a server action and then reads `result.ok`.
 * That reads fine until the call does anything other than RETURN a failure.
 *
 * Observed in production: the action POST came back 503 from the edge, so the
 * await threw. Everything after it in the submit handler was skipped — the
 * busy flag was never cleared, the error was never set, the dialog was never
 * closed. The person got a dialog that sat there silently forever, and the
 * copy written for exactly this moment ("Couldn't save. Try again.") can only
 * ever render for a clean `{ok:false}`.
 *
 * settleAction makes a thrown failure indistinguishable from a returned one,
 * so a single `if (!result.ok)` at the call site actually covers both.
 */
describe("settleAction", () => {
  it("passes a successful result through untouched", async () => {
    const result = await settleAction(async () => ({ ok: true as const, id: "abc" }));
    expect(result).toEqual({ ok: true, id: "abc" });
  });

  it("passes a returned failure through untouched", async () => {
    const result = await settleAction(async () => ({ ok: false as const, error: "invalid_role" }));
    expect(result).toEqual({ ok: false, error: "invalid_role" });
  });

  it("turns a thrown error into a returned failure", async () => {
    const result = await settleAction(async () => {
      throw new Error("Failed to fetch");
    });
    expect(result).toEqual({ ok: false, error: "unreachable" });
  });

  it("turns a rejection that is not an Error into a returned failure", async () => {
    // A 503 from the edge does not always reject with an Error instance.
    const result = await settleAction(async () => {
      throw "503";
    });
    expect(result).toEqual({ ok: false, error: "unreachable" });
  });

  it("treats a missing result as a failure rather than reading .ok off undefined", async () => {
    // The failure mode that throws a TypeError *inside* the caller's own
    // handler, which is worse than a rejected promise because it happens after
    // the await appears to have succeeded.
    const result = await settleAction(async () => undefined as unknown as { ok: true });
    expect(result).toEqual({ ok: false, error: "unreachable" });
  });
});
