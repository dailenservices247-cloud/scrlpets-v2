import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin();

const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin
  : "";
// Realtime (DM delivery) runs over a websocket to the same Supabase host.
const supabaseWsOrigin = supabaseOrigin.replace(/^https:/, "wss:");
// Fall back to the wildcard only when the env var is missing at build time,
// so a mis-provisioned build degrades instead of losing Supabase entirely.
const supabaseSources = supabaseOrigin
  ? `${supabaseOrigin} ${supabaseWsOrigin}`
  : "https://*.supabase.co wss://*.supabase.co";

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  // challenges.cloudflare.com is Turnstile. Listed here even while
  // NEXT_PUBLIC_TURNSTILE_SITE_KEY is unset, deliberately: nothing loads from
  // it without a key, and shipping the CSP change in a LATER deploy than the
  // widget would mean the day the key is added is the day CSP blocks the script
  // and every sign-in fails with no token.
  "script-src 'self' 'unsafe-inline' https://us.i.posthog.com https://*.posthog.com https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "worker-src 'self' blob:",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' ${supabaseSources} https://*.sentry.io https://us.i.posthog.com https://*.posthog.com https://challenges.cloudflare.com`,
  // Turnstile renders its challenge in an iframe, so script-src alone is not
  // enough — a missing frame-src is a widget that mounts and never completes.
  "frame-src https://accounts.google.com https://challenges.cloudflare.com",
  "upgrade-insecure-requests",
]
  .join("; ")
  .replace(/\s+/g, " ")
  .trim();

const securityHeaders = [
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Content-Security-Policy", value: contentSecurityPolicy }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default withNextIntl(nextConfig);
