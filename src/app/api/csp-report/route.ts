import * as Sentry from "@sentry/nextjs";
import {
  MAX_LOGGED_PER_INSTANCE,
  MAX_REPORT_BYTES,
  formatViolation,
  parseCspReports,
} from "@/lib/security/csp-report";

/**
 * Where the browser says what the policy refused.
 *
 * The CSP had no reporting channel until now, which is why a missing
 * `media-src` went unnoticed for months. Thin by design, same as the cron and
 * webhook routes: the parsing and redaction live in `lib/security/csp-report.ts`.
 *
 * Always 204, never a body: this is public and unauthenticated, so it must not
 * tell a prober anything about what it accepted. Nothing is stored.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const accepted = new Response(null, { status: 204 });

// Per-instance, not global: serverless instances are short-lived, so this
// bounds a report storm's log spam without pretending to be a rate limiter.
let logged = 0;

export async function POST(request: Request) {
  // Early-out before reading: a declared-oversize body is never buffered.
  // parseCspReports caps the parsed length too, for bodies that arrive without
  // a content-length at all.
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > MAX_REPORT_BYTES) return accepted.clone();

  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return accepted.clone();
  }

  for (const violation of parseCspReports(raw)) {
    if (logged >= MAX_LOGGED_PER_INSTANCE) break;
    logged += 1;
    const line = formatViolation(violation);
    console.warn(line);
    // No-op unless NEXT_PUBLIC_SENTRY_DSN is set (see instrumentation.ts).
    Sentry.captureMessage(line, "warning");
  }

  return accepted.clone();
}
