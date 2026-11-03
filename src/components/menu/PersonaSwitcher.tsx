"use client";

import { useTransition, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Loader2,
  Plus,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { BrandAccess } from "@/lib/brands/queries";
import { setActivePersona } from "@/lib/brands/persona-actions";
import { cn } from "@/lib/utils";

type PersonaSwitcherProps = {
  profile: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null;
  brands: BrandAccess[];
  activeBrandId: string | null;
};

export function PersonaSwitcher({
  profile,
  brands,
  activeBrandId,
}: PersonaSwitcherProps) {
  const [isPending, startTransition] = useTransition();
  const [switchingTarget, setSwitchingTarget] = useState<string | null>(null);
  const [showAllBrands, setShowAllBrands] = useState(false);

  if (!profile) {
    return (
      <Link
        href="/login?next=/menu"
        className="group block premium-panel rounded-2xl p-4 transition hover:border-primary/50 hover:bg-muted/20 active:scale-[0.99]"
        data-testid="menu-profile-card"
      >
        <div className="flex items-center gap-4">
          <div className="grid size-16 place-items-center rounded-2xl bg-primary/25 text-2xl font-semibold text-brand-link">
            G
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-xl font-semibold tracking-tight">Guest</h2>
            <p className="mt-1 truncate text-sm text-muted-foreground">Guest mode · Tap to sign in</p>
          </div>
          <ChevronRight
            className="size-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground"
            aria-hidden
          />
        </div>
      </Link>
    );
  }

  const activeBrand = brands.find((b) => b.id === activeBrandId) ?? null;
  const isBrandActive = Boolean(activeBrand);
  const personalDisplayName = profile.displayName ?? profile.username;

  function handleSwitch(brandId: string | null) {
    setSwitchingTarget(brandId ?? "personal");
    startTransition(async () => {
      await setActivePersona(brandId);
      setSwitchingTarget(null);
    });
  }

  return (
    <div className="space-y-3" data-testid="persona-switcher">
      {/* Active Identity Card */}
      {isBrandActive && activeBrand ? (
        <div
          className="premium-panel rounded-2xl border-primary/45 p-4"
          data-testid="active-brand-card"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3.5 min-w-0">
              {activeBrand.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={activeBrand.avatarUrl}
                  alt=""
                  width={64}
                  height={64}
                  className="size-16 rounded-2xl object-cover ring-2 ring-primary/40 shrink-0"
                />
              ) : (
                <div className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary/25 text-2xl font-semibold text-brand-link ring-2 ring-primary/40">
                  <Building2 className="size-7" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-micro font-semibold text-brand-link">
                    <Sparkles className="size-3" aria-hidden />
                    Brand Page Active
                  </span>
                  <span className="rounded-md border border-border/80 px-1.5 py-0.2 text-micro font-medium uppercase tracking-wider text-muted-foreground">
                    {activeBrand.role}
                  </span>
                </div>
                <h2 className="mt-1 truncate text-lg font-bold tracking-tight">
                  {activeBrand.name}
                </h2>
                <p className="truncate text-xs text-muted-foreground">
                  Operating as brand · Posting and managing as {activeBrand.name}
                </p>
              </div>
            </div>
          </div>

          {/* Quick Page Actions */}
          <div className="mt-4 flex flex-wrap items-center gap-2 pt-3 border-t border-border/60">
            <button
              type="button"
              onClick={() => handleSwitch(null)}
              disabled={isPending}
              data-testid="switch-to-personal-button"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-primary px-3 text-xs font-semibold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              {isPending && switchingTarget === "personal" ? (
                <Loader2 className="size-3.5 opacity-70" />
              ) : (
                <ArrowLeftRight className="size-3.5" aria-hidden />
              )}
              Switch to @{profile.username}
            </button>
            <Link
              href={`/b/${activeBrand.slug}`}
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-input px-3 text-xs font-medium text-foreground transition hover:bg-muted/60"
            >
              <ExternalLink className="size-3.5 text-muted-foreground" aria-hidden />
              View Page
            </Link>
            <Link
              href="/brand-os"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-input px-3 text-xs font-medium text-foreground transition hover:bg-muted/60"
            >
              <Building2 className="size-3.5 text-muted-foreground" aria-hidden />
              Brand OS
            </Link>
          </div>
        </div>
      ) : (
        /* Personal Identity Card */
        <Link
          href={`/u/${profile.username}`}
          className="group block premium-panel rounded-2xl p-4 transition hover:border-primary/50 hover:bg-muted/20 active:scale-[0.99]"
          data-testid="menu-profile-card"
        >
          <div className="flex items-center gap-4">
            {profile.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={profile.avatarUrl}
                alt=""
                width={80}
                height={80}
                className="size-16 sm:size-20 rounded-2xl object-cover ring-1 ring-white/15 transition group-hover:ring-primary/40 shrink-0"
              />
            ) : (
              <div className="grid size-16 sm:size-20 shrink-0 place-items-center rounded-2xl bg-primary/25 text-2xl font-semibold text-brand-link transition group-hover:bg-primary/35">
                {personalDisplayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-flex items-center gap-1 rounded-full bg-secondary/30 px-2 py-0.5 text-micro font-medium text-secondary-foreground">
                  <UserRound className="size-3" aria-hidden />
                  Personal Profile
                </span>
              </div>
              <h2 className="mt-0.5 truncate text-xl font-semibold tracking-tight transition group-hover:text-brand-link">
                {personalDisplayName}
              </h2>
              <p className="mt-0.5 truncate text-sm text-muted-foreground">
                @{profile.username}
              </p>
            </div>
            <ChevronRight
              className="size-5 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-foreground shrink-0"
              aria-hidden
            />
          </div>
        </Link>
      )}

      {/* Brand Switcher Drawer / Selector (if user manages brands) */}
      {brands.length > 0 && (
        <div
          className="rounded-2xl border border-border/70 bg-muted/25 p-3"
          data-testid="brands-switcher-panel"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold tracking-wide uppercase text-muted-foreground">
              {isBrandActive ? "Switch to Another Profile" : "Your Brand Pages"}
            </span>
            {brands.length > 2 && (
              <button
                type="button"
                onClick={() => setShowAllBrands((v) => !v)}
                className="inline-flex items-center gap-1 text-xs text-brand-link hover:underline"
              >
                {showAllBrands ? "Show less" : `View all (${brands.length})`}
                <ChevronDown
                  className={cn("size-3.5 transition", showAllBrands && "rotate-180")}
                  aria-hidden
                />
              </button>
            )}
          </div>

          <div className="mt-2.5 space-y-2">
            {/* If a brand is active, allow switching back to personal directly from list */}
            {isBrandActive && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 p-2.5 transition hover:bg-background">
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary/30 text-secondary-foreground font-semibold text-xs">
                    {personalDisplayName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">{personalDisplayName}</p>
                    <p className="truncate text-micro text-muted-foreground">
                      @{profile.username} · Personal
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSwitch(null)}
                  disabled={isPending}
                  className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg border border-input px-2.5 text-xs font-medium text-foreground transition hover:bg-muted/80 disabled:opacity-50"
                  data-testid="switch-to-personal-row"
                >
                  {isPending && switchingTarget === "personal" ? (
                    <Loader2 className="size-3 opacity-70" />
                  ) : (
                    <ArrowLeftRight className="size-3" aria-hidden />
                  )}
                  Switch
                </button>
              </div>
            )}

            {/* List of brands */}
            {(showAllBrands ? brands : brands.slice(0, 2)).map((brand) => {
              const isActive = brand.id === activeBrandId;
              const isSwitchingThis = isPending && switchingTarget === brand.id;

              return (
                <div
                  key={brand.id}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border p-2.5 transition",
                    isActive
                      ? "border-primary/60 bg-primary/10"
                      : "border-border/60 bg-background/60 hover:bg-background",
                  )}
                  data-testid={`brand-switch-row-${brand.id}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {brand.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={brand.avatarUrl}
                        alt=""
                        width={36}
                        height={36}
                        className="size-9 rounded-xl object-cover shrink-0"
                      />
                    ) : (
                      <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/20 text-brand-link font-semibold text-xs">
                        <Building2 className="size-4" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-semibold">{brand.name}</p>
                        {isActive && (
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/20 px-1.5 py-0.2 text-micro font-semibold text-brand-link">
                            <Check className="size-2.5" />
                            Active
                          </span>
                        )}
                      </div>
                      <p className="truncate text-micro text-muted-foreground capitalize">
                        {brand.role} · Page
                      </p>
                    </div>
                  </div>

                  {isActive ? (
                    <Link
                      href={`/b/${brand.slug}`}
                      className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg border border-input px-2.5 text-xs font-medium text-foreground transition hover:bg-muted/80"
                    >
                      <ExternalLink className="size-3 text-muted-foreground" />
                      Page
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleSwitch(brand.id)}
                      disabled={isPending}
                      className="inline-flex min-h-8 shrink-0 items-center gap-1 rounded-lg bg-primary/15 px-2.5 text-xs font-semibold text-brand-link transition hover:bg-primary/25 disabled:opacity-50"
                      data-testid={`switch-to-brand-${brand.id}`}
                    >
                      {isSwitchingThis ? (
                        <Loader2 className="size-3 opacity-70" />
                      ) : (
                        <ArrowLeftRight className="size-3" aria-hidden />
                      )}
                      Switch
                    </button>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mt-2.5 flex items-center justify-between pt-2 border-t border-border/50 text-xs">
            <Link
              href="/brands/new"
              className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground"
            >
              <Plus className="size-3.5" />
              Create brand page
            </Link>
            <Link
              href="/brand-os"
              className="font-medium text-brand-link hover:underline"
            >
              Brand OS →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
