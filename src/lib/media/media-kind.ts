/** F4: media kind by URL — storage URLs keep their extension. */
export function isVideoUrl(url: string | null): boolean {
  return !!url && /\.(mp4|webm|mov)(\?|#|$)/i.test(url);
}

/** Audio notes and soundbites. */
export function isAudioUrl(url: string | null): boolean {
  if (!url) return false;
  return (
    /\.(mp3|wav|m4a|ogg|aac)(\?|#|$)/i.test(url) ||
    /\/audio[-_]|\/audio\./i.test(url) ||
    url.startsWith("data:audio/") ||
    url.includes("audio-note") ||
    (url.includes(".webm") && url.includes("/audio"))
  );
}

