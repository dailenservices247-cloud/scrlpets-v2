import { describe, expect, it } from "vitest";

function calculateInspectionRemaining(
  inspectionEndsAt: string | null,
  nowMs: number = Date.now(),
): { isExpired: boolean; msRemaining: number } {
  if (!inspectionEndsAt) {
    return { isExpired: false, msRemaining: 0 };
  }
  const endMs = new Date(inspectionEndsAt).getTime();
  const diff = endMs - nowMs;
  return {
    isExpired: diff <= 0,
    msRemaining: Math.max(0, diff),
  };
}

function formatRemainingInspection(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const days = Math.floor(totalSecs / 86400);
  const hours = Math.floor((totalSecs % 86400) / 3600);
  const minutes = Math.floor((totalSecs % 3600) / 60);
  const seconds = totalSecs % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  parts.push(`${hours.toString().padStart(2, "0")}h`);
  parts.push(`${minutes.toString().padStart(2, "0")}m`);
  parts.push(`${seconds.toString().padStart(2, "0")}s`);
  return parts.join(" ");
}

describe("Order Inspection Window & Countdown Calculation", () => {
  it("accurately detects when inspection window is active vs expired", () => {
    const now = 1761890000000;
    const futureDate = new Date(now + 48 * 3600 * 1000).toISOString();
    const pastDate = new Date(now - 1000).toISOString();

    const active = calculateInspectionRemaining(futureDate, now);
    expect(active.isExpired).toBe(false);
    expect(active.msRemaining).toBe(48 * 3600 * 1000);

    const expired = calculateInspectionRemaining(pastDate, now);
    expect(expired.isExpired).toBe(true);
    expect(expired.msRemaining).toBe(0);
  });

  it("formats countdown string with days, hours, minutes, and seconds", () => {
    const ms = (2 * 86400 + 5 * 3600 + 12 * 60 + 34) * 1000;
    expect(formatRemainingInspection(ms)).toBe("2d 05h 12m 34s");

    const underOneDayMs = (4 * 3600 + 30 * 60 + 5) * 1000;
    expect(formatRemainingInspection(underOneDayMs)).toBe("04h 30m 05s");
  });

  it("calculates default 72-hour window when inspection_hours = 72", () => {
    const handoverTime = 1761890000000;
    const inspectionHours = 72;
    const computedEnd = new Date(handoverTime + inspectionHours * 3600 * 1000).toISOString();

    const result = calculateInspectionRemaining(computedEnd, handoverTime);
    expect(result.msRemaining).toBe(72 * 3600 * 1000);
    expect(formatRemainingInspection(result.msRemaining)).toBe("3d 00h 00m 00s");
  });
});
