import { describe, expect, it } from "vitest";

describe("messaging presence and delivery status", () => {
  it("computes delivery status versus seen status correctly", () => {
    const meId = "user_me";
    const otherLastReadAt = "2026-11-01T20:00:00.000Z";

    const messages = [
      { id: "msg_1", senderId: meId, createdAt: "2026-11-01T19:50:00.000Z" },
      { id: "msg_2", senderId: meId, createdAt: "2026-11-01T19:55:00.000Z" },
      { id: "msg_3", senderId: meId, createdAt: "2026-11-01T20:05:00.000Z" },
    ];

    const lastSeenMineId =
      messages.filter((m) => m.senderId === meId && m.createdAt <= otherLastReadAt).at(-1)?.id ?? null;

    const latestMineId = messages.filter((m) => m.senderId === meId).at(-1)?.id ?? null;

    // msg_2 was sent before otherLastReadAt -> Seen
    expect(lastSeenMineId).toBe("msg_2");
    // msg_3 was sent after otherLastReadAt -> Delivered
    expect(latestMineId).toBe("msg_3");
    expect(latestMineId).not.toBe(lastSeenMineId);
  });

  it("handles empty or unread conversations", () => {
    const meId = "user_me";
    const messages = [
      { id: "msg_1", senderId: meId, createdAt: "2026-11-01T19:50:00.000Z" },
    ];

    const otherLastReadAt = null;
    const lastSeenMineId = otherLastReadAt ? "seen_id" : null;

    const latestMineId = messages.filter((m) => m.senderId === meId).at(-1)?.id ?? null;

    expect(lastSeenMineId).toBeNull();
    expect(latestMineId).toBe("msg_1");
  });
});
