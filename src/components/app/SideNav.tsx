"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Menu, MessageCircle, Plus, ShoppingBag } from "lucide-react";
import { cn } from "@/lib/utils";

// F7 / punch list A21: on desktop the web app uses a left sidebar nav (like
// Facebook web) instead of a phone-style bottom bar. Mobile keeps BottomNav.
const items = [
  { href: "/", label: "Feed", icon: Home, match: (p: string) => p === "/" },
  { href: "/shop", label: "Shop", icon: ShoppingBag, match: (p: string) => p.startsWith("/shop") },
  { href: "/messages", label: "Messages", icon: MessageCircle, match: (p: string) => p.startsWith("/messages") },
  { href: "/menu", label: "Menu", icon: Menu, match: (p: string) => p === "/menu" },
];

export function SideNav() {
  const pathname = usePathname();
  return (
    <aside
      className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 border-r border-border/60 p-4 lg:flex"
      data-testid="side-nav"
    >
      <Link href="/" className="mb-4 flex items-center gap-2 px-2">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/scrlpets-icon-square.png" alt="Scrlpets" className="size-9 rounded-xl" />
        <span className="text-lg font-semibold">Scrlpets</span>
      </Link>
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.match(pathname);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition",
              active ? "bg-primary/15 text-brand-link" : "text-muted-foreground hover:bg-muted/60",
            )}
          >
            <Icon className="size-5" aria-hidden />
            {item.label}
          </Link>
        );
      })}
      <Link
        href="/compose"
        className="mt-2 flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90"
        data-testid="side-nav-post"
      >
        <Plus className="size-5" aria-hidden />
        Post
      </Link>
    </aside>
  );
}
