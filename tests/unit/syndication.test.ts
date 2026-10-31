import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { dispatchSyndication } from "@/lib/syndication/dispatcher";

describe("social syndication dispatcher", () => {
  beforeEach(() => {
    vi.stubEnv("SYNDICATION_WEBHOOK_URL", "");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns not dispatched when no webhook URL is configured", async () => {
    const res = await dispatchSyndication({
      postId: "p-123",
      authorId: "u-456",
      body: "Check out this puppy update",
      mediaUrl: "https://example.com/puppy.mp4",
      contentType: "reel",
    });

    expect(res.dispatched).toBe(false);
    expect(res.message).toContain("No syndication webhook URL");
  });

  it("successfully dispatches post payload to configured webhook", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", mockFetch);

    const res = await dispatchSyndication({
      postId: "p-123",
      authorId: "u-456",
      body: "New show dog champion training",
      mediaUrl: "https://example.com/training.mp4",
      contentType: "reel",
      webhookUrl: "https://api.zapier.com/hooks/catch/123/abc",
    });

    expect(res.dispatched).toBe(true);
    expect(res.webhookSuccess).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.zapier.com/hooks/catch/123/abc",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
        }),
      }),
    );
  });

  it("formats full videos and live streams with correct event and media format", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", mockFetch);

    const res = await dispatchSyndication({
      postId: "p-stream-1",
      authorId: "u-456",
      body: "Live Whelping Cam: Presa Canario Litter A",
      mediaUrl: "https://www.youtube.com/live/AbCdEf12345",
      contentType: "stream",
      webhookUrl: "https://api.zapier.com/hooks/catch/stream",
    });

    expect(res.dispatched).toBe(true);
    expect(res.webhookSuccess).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.zapier.com/hooks/catch/stream",
      expect.objectContaining({
        body: expect.stringContaining('"isLiveStream":true'),
      }),
    );
  });

  it("handles webhook network failure gracefully without throwing", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("Network timeout"));
    vi.stubGlobal("fetch", mockFetch);

    const res = await dispatchSyndication({
      postId: "p-123",
      authorId: "u-456",
      body: "Another update",
      mediaUrl: null,
      contentType: "post",
      webhookUrl: "https://unreachable.endpoint/hook",
    });

    expect(res.dispatched).toBe(true);
    expect(res.webhookSuccess).toBe(false);
    expect(res.message).toContain("Network timeout");
  });
});
