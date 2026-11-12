import { describe, expect, it } from "vitest";
import { encodeQr, qrPath } from "@/components/referral/qr";

describe("Creator Persona & Handover Protocol", () => {
  it("encodes valid QR payload for physical custody handover", () => {
    const orderId = "e5b8d6f1-4c2a-4a89-9132-000000000001";
    const pin = "849201";
    const payload = `scrlpets:handover:${orderId}:${pin}`;
    const qr = encodeQr(payload);
    expect(qr).not.toBeNull();
    expect(qr?.size).toBeGreaterThan(20);
    const path = qrPath(qr!);
    expect(path).toContain("M");
    expect(path).toContain("h1v1h-1z");
  });

  it("handles empty or malformed codes safely", () => {
    const qrEmpty = encodeQr("");
    expect(qrEmpty).not.toBeNull();
  });
});
