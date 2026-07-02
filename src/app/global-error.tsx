"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

// Catches errors thrown by the root layout itself (error.tsx can't).
// Must render its own <html>/<body>.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ display: "grid", placeItems: "center", minHeight: "100dvh", fontFamily: "system-ui" }}>
        <div style={{ textAlign: "center", padding: 24 }} data-testid="app-global-error">
          <h1>Something went wrong</h1>
          <p>Scrlpets hit an unexpected error.</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, padding: "10px 16px" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
