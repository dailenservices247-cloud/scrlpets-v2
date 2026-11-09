"use client";

import { Menu } from "@base-ui/react/menu";
import {
  SquarePen,
  PlusCircle,
  Clapperboard,
  Radio,
  MessageCircle,
  Plus,
} from "lucide-react";
import Link from "next/link";
import { loginHrefFor } from "@/lib/auth/redirect";

export function HeaderCreateButton({ signedIn = false }: { signedIn?: boolean }) {
  const getHref = (mode: string) =>
    signedIn ? `/compose?mode=${mode}` : loginHrefFor(`/compose?mode=${mode}`);

  const items = [
    {
      id: "post",
      label: "Post",
      href: getHref("post"),
      icon: SquarePen,
      iconClass: "text-brand-link",
    },
    {
      id: "story",
      label: "Story",
      href: getHref("story"),
      icon: PlusCircle,
      iconClass: "text-secondary",
    },
    {
      id: "reel",
      label: "Reel",
      href: getHref("reel"),
      icon: Clapperboard,
      iconClass: "text-brand-link",
    },
    {
      id: "live",
      label: "Live",
      href: getHref("live"),
      icon: Radio,
      iconClass: "text-destructive",
    },
    {
      id: "note",
      label: "Note",
      href: getHref("note"),
      icon: MessageCircle,
      iconClass: "text-accent",
    },
  ];

  return (
    <Menu.Root>
      <Menu.Trigger
        className="grid size-9 place-items-center rounded-full border border-border/80 bg-muted/45 text-muted-foreground transition hover:text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary lg:hidden"
        aria-label="Create post, story, reel, live or note"
        data-testid="header-create"
      >
        <Plus className="size-4.5 stroke-[2.2]" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner align="end" sideOffset={8} className="z-50">
          <Menu.Popup className="w-52 rounded-2xl border border-border/80 bg-popover/98 p-1.5 shadow-2xl backdrop-blur-md">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-foreground outline-none transition hover:bg-muted focus:bg-muted"
                  data-testid={`header-create-${item.id}`}
                >
                  <Icon className={`size-4.5 ${item.iconClass}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
