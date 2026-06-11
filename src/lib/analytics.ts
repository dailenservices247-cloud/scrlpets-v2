"use client";
import posthog from "posthog-js";

let ready = false;

export function initAnalytics() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || ready || typeof window === "undefined") return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: true,
  });
  ready = true;
}

/** No-op until initAnalytics ran with a key — safe to ship before the key exists (G6-B). */
export function capture(event: string, props?: Record<string, unknown>) {
  if (ready) posthog.capture(event, props);
}
