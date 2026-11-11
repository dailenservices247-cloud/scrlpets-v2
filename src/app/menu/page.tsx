import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  BookOpen,
  Bookmark,
  Building2,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Gift,
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Network,
  Package,
  PawPrint,
  Search,
  Settings,
  ShieldAlert,
  Smartphone,
  Truck,
  Users,
} from "lucide-react";
import { AppPage } from "@/components/app/AppPage";
import { cookies } from "next/headers";
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";
import { PersonaSwitcher } from "@/components/menu/PersonaSwitcher";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n/locale";
import { getSessionUser } from "@/lib/auth/session";
import { getProfileById } from "@/lib/profiles/queries";
import { getMyBrands } from "@/lib/brands/queries";
import { getActivePersonaBrandId } from "@/lib/brands/persona-actions";
import { isPlatformAdmin } from "@/lib/verification/queries";
import { isOperator, isTransporter } from "@/lib/nav/operator";

// R5: grouped sections, not a flat 23-row tile grid. Rows, not tiles — tile
// grids hide labels at small sizes. Nothing here duplicates a bottom-nav
// destination (Feed / Discover / Post / Chat / Menu stay off this page).
function MenuRow({
  href,
  icon: Icon,
  label,
  testId,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  testId?: string;
}) {
  return (
    <Link
      href={href}
      className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-2 transition hover:bg-muted/60"
      data-testid={testId}
    >
      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-background/65 text-brand-link">
        <Icon className="size-4" aria-hidden />
      </span>
      <span className="flex-1 text-ui font-medium">{label}</span>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
    </Link>
  );
}

function MenuGroup({
  heading,
  children,
  testId,
}: {
  heading?: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <section className="mt-5 px-4" data-testid={testId}>
      {heading && <p className="eyebrow mb-2">{heading}</p>}
      <div className="premium-panel rounded-2xl p-2">{children}</div>
    </section>
  );
}

export default async function MenuPage() {
  const user = await getSessionUser();
  const [profile, viewerIsAdmin, viewerIsOperator, viewerIsTransporter, brands, activeBrandId] =
    await Promise.all([
      user ? getProfileById(user.id) : Promise.resolve(null),
      user ? isPlatformAdmin() : Promise.resolve(false),
      user ? isOperator(user.id) : Promise.resolve(false),
      user ? isTransporter(user.id) : Promise.resolve(false),
      user ? getMyBrands(user.id) : Promise.resolve([]),
      user ? getActivePersonaBrandId() : Promise.resolve(null),
    ]);

  return (
    <AppPage>
      <section className="px-4 pb-4 pt-6">
        <p className="eyebrow">Menu</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your Scrlpets</h1>
      </section>

      <section className="px-4">
        <PersonaSwitcher
          profile={profile}
          brands={brands}
          activeBrandId={activeBrandId}
        />
      </section>

      <section className="mt-5 px-4">
        <div className="premium-panel rounded-2xl border-primary/35 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Account path</p>
              <p className="mt-1 text-lg font-semibold tracking-tight">Connected profile</p>
            </div>
            <div className="grid size-12 place-items-center rounded-full bg-secondary/20 text-secondary-foreground">
              <PawPrint className="size-5" aria-hidden />
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Profiles, animals, listings, and messages stay connected around each animal.
          </p>
        </div>
      </section>

      {/* R5: only what's NOT reachable from the bottom nav. */}
      <MenuGroup heading="Discover">
        <MenuRow href="/search" icon={Search} label="Search" />
        <MenuRow href="/groups" icon={Users} label="Groups & Communities" />
        <MenuRow href="/guides" icon={BookOpen} label="Guides" />
      </MenuGroup>

      <MenuGroup heading="Yours">
        <MenuRow href="/pack" icon={Users} label="Pack" />
        <MenuRow href="/saved" icon={Bookmark} label="Saved" />
        <MenuRow href="/rewards" icon={Gift} label="Rewards" />
        <MenuRow href="/health" icon={HeartPulse} label="Health" />
        <MenuRow href="/applications" icon={ClipboardList} label="Applications" />
        <MenuRow href="/orders" icon={Package} label="Orders & Deals" testId="menu-orders-row" />
      </MenuGroup>

      <MenuGroup heading="Breeding & Litters">
        <MenuRow href="/litters" icon={PawPrint} label="Litters" />
        <MenuRow href="/calendar" icon={CalendarDays} label="Breeding Calendar" />
        <MenuRow href="/tree" icon={Network} label="Pedigree & Lineage" />
      </MenuGroup>

      {user && (
        <MenuGroup heading="Brands & Operations" testId="menu-group-your-program">
          <MenuRow href="/brand-os" icon={Building2} label="Brand OS (Manage Brands)" testId="menu-brand-os-row" />
          {viewerIsOperator && (
            <MenuRow href="/hub" icon={LayoutDashboard} label="Operator Hub" />
          )}
          {viewerIsTransporter && (
            <MenuRow href="/jobs" icon={Truck} label="Transport Jobs & Quotes" testId="menu-transport-jobs-row" />
          )}
        </MenuGroup>
      )}

      <MenuGroup heading="Help & App">
        <MenuRow href="/install" icon={Smartphone} label="Install App" testId="menu-install-app-row" />
        <MenuRow href="/support" icon={LifeBuoy} label="Support" />
      </MenuGroup>

      <MenuGroup>
        <MenuRow href="/settings" icon={Settings} label="Settings" testId="menu-settings-row" />
        {viewerIsAdmin && <MenuRow href="/admin" icon={ShieldAlert} label="Admin" />}
      </MenuGroup>

      {user ? (
        <section className="mt-5 px-4">
          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border border-border/80 bg-card/60 px-4 text-sm font-semibold text-muted-foreground transition hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
              data-testid="menu-signout"
            >
              <LogOut className="size-4" aria-hidden />
              <span>Sign out</span>
            </button>
          </form>
        </section>
      ) : (
        <section className="mt-5 px-4">
          <Link href="/login" className="flex min-h-12 items-center justify-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground">
            Sign in
          </Link>
        </section>
      )}

      {/* HERE and not /settings, which is auth-only. The language is a device
          preference in a cookie and it works signed out — a Spanish-speaking
          visitor has to be able to read the app before they have an account,
          and public discovery without registration is a locked strength. It was
          on /settings first; the e2e caught that guests could never reach it. */}
      <section className="mt-5 px-4">
        <div className="premium-panel rounded-2xl p-4">
          <LanguageSwitcher
            current={resolveLocale((await cookies()).get(LOCALE_COOKIE)?.value)}
          />
        </div>
      </section>

      <section className="mt-5 px-4">
        <div className="rounded-2xl border border-border/70 bg-muted/35 p-4">
          <div className="flex gap-3">
            <Bell className="mt-0.5 size-5 text-brand-link" aria-hidden />
            <p className="text-sm leading-6 text-muted-foreground">
              Activity and account tools will fill in as real marketplace workflows come online.
            </p>
          </div>
        </div>
      </section>
    </AppPage>
  );
}
