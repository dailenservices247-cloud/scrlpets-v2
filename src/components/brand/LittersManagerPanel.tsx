"use client";

import Link from "next/link";
import { Calendar, ChevronRight } from "lucide-react";
import type { MyLitter } from "@/lib/litters/queries";

export function LittersManagerPanel({
  litters,
  brandId,
}: {
  litters: MyLitter[];
  brandId?: string;
}) {
  const brandLitters = brandId
    ? litters.filter((l) => l.brandId === brandId || !l.brandId)
    : litters;

  return (
    <div className="premium-panel rounded-2xl p-4" data-testid="litters-manager-panel">
      <div className="flex items-center justify-between">
        <div>
          <p className="eyebrow">Breeding Program</p>
          <h2 className="mt-1 text-lg font-semibold">Litters & Pairings</h2>
        </div>
        <Link
          href="/litters"
          className="rounded-lg border border-primary/50 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-brand-link hover:bg-primary/20"
        >
          + Create Litter Wizard
        </Link>
      </div>

      {brandLitters.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-border/80 p-6 text-center text-xs text-muted-foreground">
          <p>No litters recorded for this breeding program yet.</p>
          <p className="mt-1">
            Track planned matings, expected whelping dates, and manage puppy reservations.
          </p>
          <Link
            href="/litters"
            className="mt-3 inline-block font-semibold text-brand-link underline"
          >
            Start your first litter &rarr;
          </Link>
        </div>
      ) : (
        <ul className="mt-4 flex flex-col gap-3">
          {brandLitters.map((l) => (
            <li
              key={l.id}
              className="rounded-xl border border-border/70 bg-card/40 p-3"
              data-testid="brand-litter-row"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-micro font-semibold uppercase ${
                        l.status === "expecting"
                          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30"
                          : l.status === "born"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {l.status}
                    </span>
                    <Link
                      href={`/litters/${l.id}`}
                      className="text-sm font-semibold hover:underline"
                    >
                      {l.name}
                    </Link>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {l.breed ?? "Breed not specified"} &bull;{" "}
                    {l.youngCount} {l.youngCount === 1 ? "young" : "offspring"} registered
                  </p>
                  {(l.expectedDate || l.birthDate) && (
                    <p className="mt-1 flex items-center gap-1 font-mono text-micro text-muted-foreground">
                      <Calendar className="size-3" aria-hidden />
                      {l.status === "expecting" ? "Expected:" : "Born:"}{" "}
                      {l.expectedDate || l.birthDate}
                    </p>
                  )}
                </div>

                <Link
                  href={`/litters/${l.id}`}
                  className="grid size-8 place-items-center rounded-lg border border-border/80 bg-background text-muted-foreground hover:text-foreground"
                  title="View public litter details"
                >
                  <ChevronRight className="size-4" aria-hidden />
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
