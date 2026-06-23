import Link from "next/link";
import { Bell, Bone, ChevronRight, MessageCircle, PawPrint, Settings, Store } from "lucide-react";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { getProfileById } from "@/lib/profiles/queries";

const actions = [
  { href: "/", label: "Feed", icon: PawPrint },
  { href: "/shop", label: "Shop", icon: Store },
  { href: "/messages", label: "Chat", icon: MessageCircle },
  { href: "/settings/profile", label: "Settings", icon: Settings },
];

export default async function MenuPage() {
  const user = await getSessionUser();
  const profile = user ? await getProfileById(user.id) : null;
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
                {profile ? `@${profile.username}` : "Sign in to manage your animal network"}
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

      <section className="mt-5 px-4">
        <p className="eyebrow mb-3">Quick actions</p>
        <div className="grid grid-cols-2 gap-3">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.href} href={action.href} className="premium-panel rounded-2xl p-4 transition hover:border-primary/40">
                <span className="mb-5 grid size-10 place-items-center rounded-full bg-background/65 text-brand-link">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="text-base font-semibold">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

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
