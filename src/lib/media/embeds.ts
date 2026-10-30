export type EmbedProvider = "youtube" | "instagram" | "facebook" | "tiktok";

export type EmbedKind = "reel" | "video";

export interface EmbedInfo {
  provider: EmbedProvider;
  originalUrl: string;
  embedUrl: string;
  videoId: string;
  kind: EmbedKind;
  thumbnailUrl?: string;
  platformName: string;
}

/**
 * Checks if a given URL points to a supported external video or post embed.
 */
export function isEmbedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return !!parseEmbedUrl(url);
}

/**
 * Parses a social URL and extracts embed details.
 */
export function parseEmbedUrl(url: string | null | undefined): EmbedInfo | null {
  if (!url) return null;
  const trimmed = url.trim();

  // 1. YouTube
  // Standard: youtube.com/watch?v=... or m.youtube.com/watch?v=...
  // Short URL: youtu.be/...
  // Shorts: youtube.com/shorts/...
  // Embed: youtube.com/embed/...
  const ytMatch =
    trimmed.match(/(?:https?:\/\/)?(?:www\.|m\.)?youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/i) ||
    trimmed.match(/(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/i) ||
    trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i);

  const ytShortsMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i);

  if (ytShortsMatch) {
    const videoId = ytShortsMatch[1];
    return {
      provider: "youtube",
      originalUrl: trimmed,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`,
      videoId,
      kind: "reel",
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      platformName: "YouTube Shorts",
    };
  }

  if (ytMatch) {
    const videoId = ytMatch[1];
    return {
      provider: "youtube",
      originalUrl: trimmed,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`,
      videoId,
      kind: "video",
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      platformName: "YouTube",
    };
  }

  // 2. Instagram
  // Reels: instagram.com/reel/CODE or instagram.com/reels/CODE
  // Posts: instagram.com/p/CODE
  const igReelMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:reel|reels)\/([a-zA-Z0-9_-]+)/i);
  if (igReelMatch) {
    const code = igReelMatch[1];
    return {
      provider: "instagram",
      originalUrl: trimmed,
      embedUrl: `https://www.instagram.com/reel/${code}/embed`,
      videoId: code,
      kind: "reel",
      platformName: "Instagram Reel",
    };
  }

  const igPostMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/p\/([a-zA-Z0-9_-]+)/i);
  if (igPostMatch) {
    const code = igPostMatch[1];
    return {
      provider: "instagram",
      originalUrl: trimmed,
      embedUrl: `https://www.instagram.com/p/${code}/embed`,
      videoId: code,
      kind: "video",
      platformName: "Instagram Post",
    };
  }

  // 3. Facebook
  // facebook.com/watch/?v=ID or facebook.com/.../videos/ID or fb.watch/ID
  const fbWatchMatch =
    trimmed.match(/(?:https?:\/\/)?(?:www\.|web\.)?facebook\.com\/watch\/?\?v=([0-9]+)/i) ||
    trimmed.match(/(?:https?:\/\/)?(?:www\.|web\.)?facebook\.com\/.*\/videos\/([0-9]+)/i);

  if (fbWatchMatch || /(?:https?:\/\/)?fb\.watch\/[a-zA-Z0-9_-]+/i.test(trimmed)) {
    const videoId = fbWatchMatch ? fbWatchMatch[1] : trimmed;
    return {
      provider: "facebook",
      originalUrl: trimmed,
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(trimmed)}&show_text=0`,
      videoId,
      kind: "video",
      platformName: "Facebook Video",
    };
  }

  // 4. TikTok
  // tiktok.com/@user/video/ID
  const ttMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@[^/]+\/video\/([0-9]+)/i);
  if (ttMatch) {
    const videoId = ttMatch[1];
    return {
      provider: "tiktok",
      originalUrl: trimmed,
      embedUrl: `https://www.tiktok.com/embed/v2/${videoId}`,
      videoId,
      kind: "reel",
      platformName: "TikTok",
    };
  }

  return null;
}
