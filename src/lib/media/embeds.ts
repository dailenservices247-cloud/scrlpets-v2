export type EmbedProvider = "youtube" | "instagram" | "facebook" | "tiktok" | "twitch";

export type EmbedKind = "reel" | "video" | "stream";

export interface EmbedInfo {
  provider: EmbedProvider;
  originalUrl: string;
  embedUrl: string;
  videoId: string;
  kind: EmbedKind;
  thumbnailUrl?: string;
  platformName: string;
}

const URL_REGEX = /https?:\/\/[^\s]+/gi;

/**
 * Extracts the first supported social embed URL from a freeform text string.
 */
export function extractFirstEmbedUrl(text: string | null | undefined): string | null {
  if (!text) return null;
  const matches = text.match(URL_REGEX);
  if (!matches) return null;
  for (const rawUrl of matches) {
    const cleanUrl = rawUrl.replace(/[.,!?;:)>\]]+$/, "");
    if (isEmbedUrl(cleanUrl)) {
      return cleanUrl;
    }
  }
  return null;
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
  const ytLiveMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/i);

  if (ytLiveMatch) {
    const videoId = ytLiveMatch[1];
    return {
      provider: "youtube",
      originalUrl: trimmed,
      embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0`,
      videoId,
      kind: "stream",
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      platformName: "YouTube Live Stream",
    };
  }

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
  // Reels: instagram.com/reel/CODE, instagram.com/reels/CODE, or instagram.com/share/reel/CODE
  // Posts: instagram.com/p/CODE or instagram.com/share/p/CODE
  const igReelMatch =
    trimmed.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:reel|reels|share\/reel)\/([a-zA-Z0-9_-]+)/i);
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

  const igPostMatch =
    trimmed.match(/(?:https?:\/\/)?(?:www\.)?instagram\.com\/(?:p|share\/p)\/([a-zA-Z0-9_-]+)/i) ||
    trimmed.match(/(?:https?:\/\/)?(?:www\.)?instagr\.am\/p\/([a-zA-Z0-9_-]+)/i);
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
  // facebook.com/watch/?v=ID or facebook.com/.../videos/ID or fb.watch/ID or facebook.com/reel/ID
  const fbReelMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.|web\.)?facebook\.com\/(?:reel|reels)\/([0-9]+)/i);
  if (fbReelMatch) {
    const videoId = fbReelMatch[1];
    return {
      provider: "facebook",
      originalUrl: trimmed,
      embedUrl: `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(trimmed)}&show_text=0`,
      videoId,
      kind: "reel",
      platformName: "Facebook Reel",
    };
  }

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
  // Standard video: tiktok.com/@user/video/ID
  // Photo post: tiktok.com/@user/photo/ID
  // Short URL: tiktok.com/t/CODE, vt.tiktok.com/CODE, vm.tiktok.com/CODE
  const ttStandardMatch =
    trimmed.match(/(?:https?:\/\/)?(?:www\.|m\.)?tiktok\.com\/@[^/]+\/(?:video|photo)\/([0-9]+)/i);
  if (ttStandardMatch) {
    const videoId = ttStandardMatch[1];
    return {
      provider: "tiktok",
      originalUrl: trimmed,
      embedUrl: `https://www.tiktok.com/embed/v2/${videoId}`,
      videoId,
      kind: "reel",
      platformName: "TikTok",
    };
  }

  const ttShortMatch =
    trimmed.match(/(?:https?:\/\/)?(?:www\.)?tiktok\.com\/t\/([a-zA-Z0-9_-]+)/i) ||
    trimmed.match(/(?:https?:\/\/)?(?:vt|vm)\.tiktok\.com\/([a-zA-Z0-9_-]+)/i);
  if (ttShortMatch) {
    const code = ttShortMatch[1];
    return {
      provider: "tiktok",
      originalUrl: trimmed,
      embedUrl: `https://www.tiktok.com/embed/v2/${code}`,
      videoId: code,
      kind: "reel",
      platformName: "TikTok",
    };
  }

  // 5. Twitch Live Streams & Clips
  const twitchMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?twitch\.tv\/([a-zA-Z0-9_]{3,25})/i);
  if (twitchMatch) {
    const channel = twitchMatch[1];
    return {
      provider: "twitch",
      originalUrl: trimmed,
      embedUrl: `https://player.twitch.tv/?channel=${channel}&parent=scrlpets.com&parent=localhost&autoplay=false`,
      videoId: channel,
      kind: "stream",
      platformName: "Twitch Live Stream",
    };
  }

  return null;
}
