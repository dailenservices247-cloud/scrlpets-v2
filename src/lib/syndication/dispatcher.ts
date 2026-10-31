/**
 * Social Syndication & Cross-Posting Dispatcher
 *
 * Allows publishing to Scrlpets to automatically syndicate out to connected
 * social platforms (YouTube, Instagram, Facebook, TikTok) via webhooks (Zapier,
 * Make, Ayrshare, n8n, Buffer) or direct platform APIs.
 */

export type SyndicatedContentType = "post" | "reel" | "long_video" | "stream";

export interface SyndicationOptions {
  postId: string;
  authorId: string;
  body: string | null;
  mediaUrl: string | null;
  contentType: SyndicatedContentType;
  platforms?: string[];
  webhookUrl?: string;
  isLiveStream?: boolean;
}

export interface SyndicationResult {
  dispatched: boolean;
  webhookSuccess?: boolean;
  message?: string;
}

export async function dispatchSyndication(
  options: SyndicationOptions,
): Promise<SyndicationResult> {
  const { postId, authorId, body, mediaUrl, contentType, platforms } = options;

  const targetWebhook =
    options.webhookUrl ||
    process.env.SYNDICATION_WEBHOOK_URL ||
    process.env.NEXT_PUBLIC_SYNDICATION_WEBHOOK_URL;

  const canonicalUrl = `https://scrlpets.com/${contentType === "reel" ? "watch/reel" : contentType === "long_video" || contentType === "stream" ? "watch" : "post"}/${postId}`;

  const payload = {
    event: options.isLiveStream || contentType === "stream" ? "stream.broadcast" : "post.published",
    timestamp: new Date().toISOString(),
    post: {
      id: postId,
      authorId,
      body,
      mediaUrl,
      contentType,
      mediaFormat: contentType === "reel" ? "vertical_short" : contentType === "stream" ? "live_stream" : "horizontal_video",
      isLiveStream: options.isLiveStream || contentType === "stream",
      canonicalUrl,
      platforms: platforms && platforms.length > 0 ? platforms : ["all"],
    },
  };

  // If no webhook configured in env, record dispatch readiness
  if (!targetWebhook) {
    return {
      dispatched: false,
      message: "No syndication webhook URL configured in settings or environment.",
    };
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout

    const res = await fetch(targetWebhook, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "Scrlpets-Syndicator/1.0",
        ...(process.env.SYNDICATION_SECRET
          ? { "X-Scrlpets-Signature": process.env.SYNDICATION_SECRET }
          : {}),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    return {
      dispatched: true,
      webhookSuccess: res.ok,
      message: res.ok
        ? "Post successfully dispatched to syndication pipeline."
        : `Syndication endpoint returned status ${res.status}`,
    };
  } catch (err) {
    // Non-blocking: never abort user publishing if syndication network fails
    const message = err instanceof Error ? err.message : String(err);
    return {
      dispatched: true,
      webhookSuccess: false,
      message: `Failed to dispatch syndication: ${message}`,
    };
  }
}
