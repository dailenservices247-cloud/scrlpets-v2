"use client";

import Link from "next/link";
import {
  BookOpen,
  CalendarDays,
  GitFork,
  LifeBuoy,
  PawPrint,
  Scale,
  Store,
  Users,
} from "lucide-react";

export function RightRail() {
  return (
    <aside
      className="sticky top-0 hidden h-dvh w-60 min-[1280px]:w-72 min-[1440px]:w-80 shrink-0 flex-col gap-6 overflow-y-auto p-4 min-[1140px]:flex scrollbar-none"
      data-testid="right-rail"
      aria-label="Platform Shortcuts and Guides"
    >
      {/* 1. Marketplace & Verification */}
      <section className="space-y-2.5">
        <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
          Marketplace &amp; Safety
        </p>

        <Link
          href="/market"
          className="group flex items-start gap-3 rounded-xl p-2 transition hover:bg-muted/40"
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-border/80 bg-primary/15 text-brand-link">
            <Store className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-semibold text-foreground transition group-hover:text-brand-link">
              Marketplace
            </h3>
            <p className="mt-0.5 text-micro leading-normal text-muted-foreground">
              Browse verified listings, supplies, and bookable animal services.
            </p>
          </div>
        </Link>

        <Link
          href="/guides/animal-legality"
          className="group flex items-start gap-3 rounded-xl p-2 transition hover:bg-muted/40"
        >
          <div className="grid size-10 shrink-0 place-items-center rounded-xl border border-border/80 bg-secondary/15 text-secondary-foreground">
            <Scale className="size-5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-semibold text-foreground transition group-hover:text-brand-link">
              Compliance &amp; Legality
            </h3>
            <p className="mt-0.5 text-micro leading-normal text-muted-foreground">
              Species permit tiers, interstate health rules, and buyer protection.
            </p>
          </div>
        </Link>
      </section>

      <div className="h-px w-full bg-border/60" />

      {/* 2. Lineage & Operations */}
      <section className="space-y-2">
        <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
          Lineage &amp; Operations
        </p>

        <div className="space-y-1">
          {[
            { href: "/tree", label: "Pedigree & Tree Builder", icon: GitFork },
            { href: "/litters", label: "Litters & Pairings", icon: PawPrint },
            { href: "/calendar", label: "Care & Breeding Calendar", icon: CalendarDays },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
              >
                <Icon className="size-4 text-brand-link shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <div className="h-px w-full bg-border/60" />

      {/* 3. Community & Support */}
      <section className="space-y-2 flex-1">
        <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
          Community &amp; Support
        </p>

        <div className="space-y-1">
          {[
            { href: "/groups", label: "Groups & Communities", icon: Users },
            { href: "/guides", label: "Stewardship Guides", icon: BookOpen },
            { href: "/support", label: "Help & Support", icon: LifeBuoy },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-xs font-medium text-muted-foreground transition hover:bg-muted/50 hover:text-foreground"
              >
                <Icon className="size-4 text-secondary-foreground shrink-0" aria-hidden />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Footer copyright & links */}
      <div className="text-micro text-muted-foreground space-x-1.5 pt-2">
        <Link href="/privacy" className="hover:underline">Privacy</Link>
        <span>·</span>
        <Link href="/terms" className="hover:underline">Terms</Link>
        <span>·</span>
        <Link href="/support" className="hover:underline">Support</Link>
        <span>·</span>
        <span>Scrlpets © 2026</span>
      </div>
    </aside>
  );
}
