import Link from "next/link";

export default function NotFound() {
  return (
    <main className="app-surface grid min-h-dvh place-items-center px-4">
      <div className="premium-panel w-full max-w-sm rounded-2xl p-6 text-center" data-testid="app-not-found">
        <p className="eyebrow">Scrlpets</p>
        <h1 className="mt-1 text-2xl font-semibold">Page not found</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          This page doesn&apos;t exist — the animal may have wandered off.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-secondary px-4 text-sm font-semibold text-secondary-foreground"
        >
          Back to feed
        </Link>
      </div>
    </main>
  );
}
