import { describe, expect, it } from "vitest";
import { isEmbedUrl, parseEmbedUrl } from "@/lib/media/embeds";

describe("embeds parser", () => {
  it("detects and parses standard YouTube video URLs", () => {
    const url = "https://www.youtube.com/watch?v=dQw4w9WgXcQ";
    expect(isEmbedUrl(url)).toBe(true);
    const parsed = parseEmbedUrl(url);
    expect(parsed).not.toBeNull();
    expect(parsed?.provider).toBe("youtube");
    expect(parsed?.videoId).toBe("dQw4w9WgXcQ");
    expect(parsed?.kind).toBe("video");
    expect(parsed?.embedUrl).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?rel=0");
    expect(parsed?.thumbnailUrl).toBe("https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg");
  });

  it("detects and parses youtu.be short URLs", () => {
    const url = "https://youtu.be/dQw4w9WgXcQ?t=42";
    expect(isEmbedUrl(url)).toBe(true);
    const parsed = parseEmbedUrl(url);
    expect(parsed?.provider).toBe("youtube");
    expect(parsed?.videoId).toBe("dQw4w9WgXcQ");
  });

  it("detects YouTube Shorts as reel kind", () => {
    const url = "https://www.youtube.com/shorts/AbCdEf12345";
    expect(isEmbedUrl(url)).toBe(true);
    const parsed = parseEmbedUrl(url);
    expect(parsed?.provider).toBe("youtube");
    expect(parsed?.videoId).toBe("AbCdEf12345");
    expect(parsed?.kind).toBe("reel");
  });

  it("detects and parses Instagram Reels", () => {
    const url = "https://www.instagram.com/reel/C7xYz12345/";
    expect(isEmbedUrl(url)).toBe(true);
    const parsed = parseEmbedUrl(url);
    expect(parsed?.provider).toBe("instagram");
    expect(parsed?.videoId).toBe("C7xYz12345");
    expect(parsed?.kind).toBe("reel");
    expect(parsed?.embedUrl).toBe("https://www.instagram.com/reel/C7xYz12345/embed");
  });

  it("detects and parses Facebook videos", () => {
    const url = "https://www.facebook.com/watch/?v=123456789012345";
    expect(isEmbedUrl(url)).toBe(true);
    const parsed = parseEmbedUrl(url);
    expect(parsed?.provider).toBe("facebook");
    expect(parsed?.kind).toBe("video");
    expect(parsed?.embedUrl).toContain("facebook.com/plugins/video.php");
  });

  it("detects and parses TikTok videos", () => {
    const url = "https://www.tiktok.com/@creator/video/7123456789012345678";
    expect(isEmbedUrl(url)).toBe(true);
    const parsed = parseEmbedUrl(url);
    expect(parsed?.provider).toBe("tiktok");
    expect(parsed?.kind).toBe("reel");
  });

  it("returns null for non-embed URLs", () => {
    expect(isEmbedUrl("https://example.com/image.jpg")).toBe(false);
    expect(parseEmbedUrl("https://example.com/image.jpg")).toBeNull();
    expect(isEmbedUrl(null)).toBe(false);
  });
});
