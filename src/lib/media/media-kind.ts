/** F4: media kind by URL — storage URLs keep their extension. */
export function isVideoUrl(url: string | null): boolean {
  return !!url && /\.(mp4|webm|mov)(\?|#|$)/i.test(url);
}
