import * as Sentry from "@sentry/nextjs";

// Browser Sentry init (G6 slice-1). No-op without the DSN (local dev).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
