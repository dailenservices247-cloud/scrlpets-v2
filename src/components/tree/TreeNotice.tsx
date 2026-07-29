import Link from "next/link";
import type { LucideIcon } from "lucide-react";

// Same shape as the brand-os "no brands yet" empty state — reused here for
// every honest-notice case the tree needs: signed-out, private, buyers-only.
export function TreeNotice({
  icon: Icon,
  eyebrow,
  title,
  body,
  cta,
  testId,
}: {
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  body: string;
  cta?: { href: string; label: string };
  testId: string;
}) {
  return (
    <section className="px-3 pb-3 pt-4" data-testid={testId}>
      <div className="premium-panel rounded-2xl p-6 text-center">
        <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl border border-accent/35 bg-accent/15 text-accent">
          <Icon className="size-7" aria-hidden />
        </div>
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-1 text-2xl font-semibold">{title}</h1>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted-foreground">{body}</p>
        {cta && (
          <Link
            href={cta.href}
            className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-secondary px-5 font-semibold text-secondary-foreground"
            data-testid={`${testId}-cta`}
          >
            {cta.label}
          </Link>
        )}
      </div>
    </section>
  );
}
