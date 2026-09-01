"use client";
import posthog from "posthog-js";

let ready = false;

export function initAnalytics() {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  if (!key || ready || typeof window === "undefined") return;
  posthog.init(key, {
    api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://us.i.posthog.com",
    capture_pageview: true,
    opt_out_capturing_by_default: true,
  });
  ready = true;
}

export function enableAnalytics() {
  initAnalytics();
  if (ready) posthog.opt_in_capturing();
}

export function disableAnalytics() {
  if (ready) posthog.opt_out_capturing();
}

/** No-op until the visitor explicitly enables analytics. */
export function capture(event: string, props?: Record<string, unknown>) {
  if (ready && !posthog.has_opted_out_capturing()) posthog.capture(event, props);
}

export { FUNNEL_EVENTS, type FunnelEvent } from "./analytics/events";
