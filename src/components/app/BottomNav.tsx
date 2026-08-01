"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Home, Menu, MessageCircle, Plus, Store } from "lucide-react";
import { cn } from "@/lib/utils";

// Slot 2 is /market — the merged marketplace. It was /discover, a browse hub
// that cost a tap before the thing people came for; Discover survives as a
// route but stops being a nav slot. labelKey stays stable across locales so
// the data-testid derivation below never changes with translation.
const items = [
  { href: "/", labelKey: "feed", icon: Home, match: (path: string) => path === "/" },
  { href: "/market", labelKey: "market", icon: Store, match: (path: string) => path.startsWith("/market") },
  { href: "/compose", labelKey: "post", icon: Plus, primary: true, match: (path: string) => path === "/compose" },
  { href: "/messages", labelKey: "chat", icon: MessageCircle, match: (path: string) => path.startsWith("/messages") },
  { href: "/menu", labelKey: "menu", icon: Menu, match: (path: string) => path === "/menu" },
];

export function BottomNav() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 mx-auto max-w-md border-t lg:hidden border-border/80 bg-[#202124]/95 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl"
      aria-label="Primary"
      data-testid="bottom-nav"
    >
      <div className="grid grid-cols-5 items-end gap-1">
        {items.map((item) => {
          const Icon = item.icon;
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              // SideNav has carried this since it shipped; the mobile nav — the
              // primary form factor — was missed, leaving colour as the only
              // signal of where you are.
              aria-current={active ? "page" : undefined}
              className={cn(
                "group flex min-h-14 flex-col items-center justify-end gap-1 rounded-lg px-1 text-[11px] font-medium text-muted-foreground transition",
                active && "text-brand-link",
                item.primary && "-mt-5 text-foreground",
              )}
              data-testid={item.href === "/messages" ? "messages-link" : `nav-${item.labelKey}`}
            >
              <span
                className={cn(
                  "grid place-items-center rounded-full transition",
                  item.primary
                    ? "size-14 border border-[color:var(--brand-on-wine)]/25 bg-primary text-primary-foreground shadow-[0_10px_28px_rgba(126,48,58,.42)]"
                    : "size-8 group-hover:bg-muted/70",
                  active && !item.primary && "bg-primary/15 ring-1 ring-primary/35",
                )}
              >
                <Icon className={item.primary ? "size-6" : "size-5"} aria-hidden />
              </span>
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
