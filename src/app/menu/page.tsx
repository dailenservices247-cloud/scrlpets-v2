import Link from "next/link";
import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Bell,
  Bone,
  BookOpen,
  Bookmark,
  Building2,
  ChevronRight,
  ClipboardList,
  Gift,
  HeartPulse,
  LayoutDashboard,
  LifeBuoy,
  Search,
  Settings,
  ShieldAlert,
  Users,
} from "lucide-react";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { getProfileById } from "@/lib/profiles/queries";
import { isPlatformAdmin } from "@/lib/verification/queries";
import { isOperator } from "@/lib/nav/operator";

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
      <span className="flex-1 text-[15px] font-medium">{label}</span>
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
  const [profile, viewerIsAdmin, viewerIsOperator] = await Promise.all([
    user ? getProfileById(user.id) : Promise.resolve(null),
    user ? isPlatformAdmin() : Promise.resolve(false),
    user ? isOperator(user.id) : Promise.resolve(false),
  ]);
  const displayName = profile?.displayName ?? profile?.username ?? user?.email ?? "Guest";

  return (
    <AppPage>
      <section className="px-4 pb-4 pt-6">
        <p className="eyebrow">Menu</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight">Your Scrlpets</h1>
      </section>

      <section className="px-4">
        <div className="premium-panel rounded-2xl p-4" data-testid="menu-profile-card">
          <div className="flex items-center gap-4">
            {profile?.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={profile.avatarUrl} alt="" width={80} height={80} className="size-20 rounded-2xl object-cover ring-1 ring-white/15" />
            ) : (
              <div className="grid size-20 place-items-center rounded-2xl bg-primary/25 text-2xl font-semibold text-brand-link">
                {displayName.slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h2 className="truncate text-xl font-semibold tracking-tight">{displayName}</h2>
              <p className="mt-1 truncate text-sm text-muted-foreground">
                {profile ? `@${profile.username}` : "Guest mode"}
              </p>
            </div>
            {profile ? (
              <Link href={`/u/${profile.username}`} className="text-muted-foreground" aria-label="View profile">
                <ChevronRight className="size-5" aria-hidden />
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-5 px-4">
        <div className="premium-panel rounded-2xl border-primary/35 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="eyebrow">Account path</p>
              <p className="mt-1 text-lg font-semibold tracking-tight">Animal-first profile</p>
            </div>
            <div className="grid size-12 place-items-center rounded-full bg-secondary/20 text-secondary-foreground">
              <Bone className="size-5" aria-hidden />
            </div>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Profiles, animals, listings, and messages stay connected around the animal.
          </p>
        </div>
      </section>

      {/* R5: only what's NOT reachable from the bottom nav. */}
      <MenuGroup heading="Discover">
        <MenuRow href="/search" icon={Search} label="Search" />
        <MenuRow href="/guides" icon={BookOpen} label="Guides" />
      </MenuGroup>

      <MenuGroup heading="Yours">
        <MenuRow href="/pack" icon={Users} label="Pack" />
        <MenuRow href="/saved" icon={Bookmark} label="Saved" />
        <MenuRow href="/rewards" icon={Gift} label="Rewards" />
        <MenuRow href="/health" icon={HeartPulse} label="Health" />
        <MenuRow href="/applications" icon={ClipboardList} label="Applications" />
      </MenuGroup>

      {viewerIsOperator && (
        <MenuGroup heading="Your program" testId="menu-group-your-program">
          {/* /hub is built by another lane; linked ahead of that landing. */}
          <MenuRow href="/hub" icon={LayoutDashboard} label="Operator Hub" />
          <MenuRow href="/brand-os" icon={Building2} label="Brand OS" />
        </MenuGroup>
      )}

      <MenuGroup heading="Help">
        <MenuRow href="/support" icon={LifeBuoy} label="Support" />
      </MenuGroup>

      <MenuGroup>
        <MenuRow href="/settings" icon={Settings} label="Settings" testId="menu-settings-row" />
        {viewerIsAdmin && <MenuRow href="/admin" icon={ShieldAlert} label="Admin" />}
      </MenuGroup>

      {!user && (
        <section className="mt-5 px-4">
          <Link href="/login" className="flex min-h-12 items-center justify-center rounded-xl bg-primary px-4 font-semibold text-primary-foreground">
            Sign in
          </Link>
        </section>
      )}

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
