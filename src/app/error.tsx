"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surfaced in dev console; Sentry hook lands here once a DSN exists (G6).
    console.error(error);
  }, [error]);

  return (
    <main className="app-surface grid min-h-dvh place-items-center px-4">
      <div className="premium-panel w-full max-w-sm rounded-2xl p-6 text-center" data-testid="app-error">
        <p className="eyebrow">Scrlpets</p>
        <h1 className="mt-1 text-2xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The page hit an unexpected error. Try again, or head back to the feed.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={reset}
            className="min-h-11 rounded-xl border border-input px-4 text-sm font-medium text-brand-link"
          >
            Try again
          </button>
          <Link
            href="/"
            className="grid min-h-11 place-items-center rounded-xl bg-secondary px-4 text-sm font-semibold text-secondary-foreground"
          >
            Back to feed
          </Link>
        </div>
      </div>
    </main>
  );
}
