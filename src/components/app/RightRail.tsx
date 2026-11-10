"use client";

import Link from "next/link";
import { Cake, Sparkles, ExternalLink, ShieldCheck, MessageSquare } from "lucide-react";

export function RightRail() {
  return (
    <aside
      className="sticky top-0 hidden h-dvh w-60 min-[1280px]:w-72 min-[1440px]:w-80 shrink-0 flex-col gap-6 overflow-y-auto border-l border-border/60 p-4 min-[1140px]:flex scrollbar-none"
      data-testid="right-rail"
      aria-label="Community and Sponsored Sidebar"
    >
      {/* 1. Sponsored Section (Facebook Desktop Style) */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
            Sponsored
          </p>
          <span className="text-micro text-muted-foreground/60" title="Verified advertisers">🌐</span>
        </div>

        {/* Sponsored Card 1 */}
        <Link
          href="/b/danus-ark"
          className="group flex items-start gap-3 rounded-xl p-2 transition hover:bg-muted/40"
          data-testid="sponsored-card-1"
        >
          <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-muted/60">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/brand/scrlpets-icon-192.png"
              alt="Danu's Ark"
              className="size-full object-cover transition duration-300 group-hover:scale-105"
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-xs font-bold leading-snug text-foreground transition group-hover:text-brand-link">
              Danu&apos;s Ark Working Presas
            </h3>
            <p className="mt-1 line-clamp-2 text-micro leading-normal text-muted-foreground">
              Clean bone density, spring & core drive conditioning.
            </p>
            <span className="mt-1.5 inline-flex items-center gap-1 text-micro font-medium text-brand-link/85">
              <span>danusark.com</span>
              <ExternalLink className="size-2.5" />
            </span>
          </div>
        </Link>

        {/* Sponsored Card 2 */}
        <Link
          href="/breeder-os"
          className="group flex items-start gap-3 rounded-xl p-2 transition hover:bg-muted/40"
          data-testid="sponsored-card-2"
        >
          <div className="relative size-24 shrink-0 overflow-hidden rounded-xl border border-border/80 bg-secondary/15 flex items-center justify-center">
            <ShieldCheck className="size-10 text-[#347466] dark:text-[#64bca9]" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-xs font-bold leading-snug text-foreground transition group-hover:text-brand-link">
              Breeder OS & COI Tool
            </h3>
            <p className="mt-1 line-clamp-2 text-micro leading-normal text-muted-foreground">
              Calculate genetic coefficients & pedigree trees.
            </p>
            <span className="mt-1.5 inline-flex items-center gap-1 text-micro font-medium text-brand-link/85">
              <span>scrlpets.com/breeder-os</span>
              <ExternalLink className="size-2.5" />
            </span>
          </div>
        </Link>
      </section>

      <div className="h-px w-full bg-border/60" />

      {/* 2. Pet Milestones & Gotcha Days Section */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between">
          <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
            Pet Milestones & Care
          </p>
          <Sparkles className="size-3 text-accent" />
        </div>

        <div className="flex items-start gap-3 rounded-xl border border-border/70 bg-card/60 p-3 shadow-xs">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-accent/20 text-accent">
            <Cake className="size-4" />
          </div>
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-semibold text-foreground">
              Bramble&apos;s Gotcha Day
            </p>
            <p className="text-micro text-muted-foreground mt-0.5">
              Celebrating 2 years with the family today! 🐾
            </p>
            <Link
              href="/compose?mode=story"
              className="mt-2 inline-flex items-center rounded-lg bg-primary/15 px-2.5 py-1 text-micro font-semibold text-brand-link transition hover:bg-primary/25"
            >
              Share moment
            </Link>
          </div>
        </div>
      </section>

      <div className="h-px w-full bg-border/60" />

      {/* 3. Your Pack & Kennels (Active Community Contacts) */}
      <section className="space-y-2 flex-1">
        <div className="flex items-center justify-between">
          <p className="text-micro font-semibold uppercase tracking-wider text-muted-foreground">
            Your Pack & Kennels
          </p>
          <span className="text-micro font-medium text-brand-link">4 online</span>
        </div>

        <div className="space-y-1 pt-1">
          {[
            {
              name: "Danu's Ark",
              handle: "danusark",
              avatar: "/brand/scrlpets-icon-192.png",
              href: "/b/danus-ark",
              status: "Online",
            },
            {
              name: "Golden Club",
              handle: "goldenclub",
              avatar: null,
              href: "/search?q=golden",
              status: "Active 15m ago",
            },
            {
              name: "Solaria Presas",
              handle: "solaria",
              avatar: null,
              href: "/search?q=solaria",
              status: "Online",
            },
            {
              name: "Nova Colony",
              handle: "novacolony",
              avatar: null,
              href: "/search?q=nova",
              status: "Active 1h ago",
            },
          ].map((contact) => (
            <Link
              key={contact.handle}
              href={contact.href}
              className="group flex items-center justify-between rounded-xl px-2.5 py-2 transition hover:bg-muted/50"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="relative shrink-0">
                  {contact.avatar ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={contact.avatar}
                      alt=""
                      className="size-8 rounded-full object-cover"
                    />
                  ) : (
                    <div className="grid size-8 place-items-center rounded-full bg-primary/20 text-xs font-bold text-brand-link">
                      {contact.name.slice(0, 1)}
                    </div>
                  )}
                  {contact.status === "Online" && (
                    <span className="absolute bottom-0 right-0 size-2.5 rounded-full bg-emerald-500 ring-2 ring-background" />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground group-hover:text-brand-link transition">
                    {contact.name}
                  </p>
                  <p className="text-micro text-muted-foreground truncate">
                    {contact.status}
                  </p>
                </div>
              </div>
              <MessageSquare className="size-3.5 text-muted-foreground/60 opacity-0 group-hover:opacity-100 transition" />
            </Link>
          ))}
        </div>
      </section>

      {/* Footer copyright & links */}
      <div className="text-micro text-muted-foreground/70 space-x-1.5 pt-2">
        <Link href="/privacy" className="hover:underline">Privacy</Link>
        <span>·</span>
        <Link href="/terms" className="hover:underline">Terms</Link>
        <span>·</span>
        <Link href="/help" className="hover:underline">Help</Link>
        <span>·</span>
        <span>Scrlpets © 2026</span>
      </div>
    </aside>
  );
}
