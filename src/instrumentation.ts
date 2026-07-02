import * as Sentry from "@sentry/nextjs";

// Server + edge Sentry init (G6 slice-1). No-op when the DSN env var is absent (local dev).
// Source-map upload deliberately skipped — needs SENTRY_AUTH_TOKEN; banked for a later pass.
export function register() {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.1,
    enableLogs: false,
  });
}

export const onRequestError = Sentry.captureRequestError;
