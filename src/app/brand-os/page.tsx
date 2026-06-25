import Link from "next/link";
import {
  BadgeDollarSign,
  Bell,
  Building2,
  CalendarClock,
  ChevronRight,
  FileText,
  Handshake,
  HeartHandshake,
  Megaphone,
  MessageCircle,
  PawPrint,
  PenSquare,
  Settings,
  ShieldCheck,
  ShoppingBag,
  UsersRound,
} from "lucide-react";
import { AppPage } from "@/components/app/AppPage";
import { getBrandSurfaceBySlug } from "@/lib/profile-identity";

const brand = getBrandSurfaceBySlug("blue-river-kennels");

const quickActions = [
  { label: "Post update", icon: PenSquare, href: "/compose" },
  { label: "New listing", icon: BadgeDollarSign, href: "/compose?mode=listing" },
  { label: "Add animal", icon: PawPrint, href: "/brand-os" },
  { label: "Invite operator", icon: UsersRound, href: "/brand-os" },
];

const overview = [
  { label: "Active listings", value: "24", tone: "primary" },
  { label: "Unread inquiries", value: "8", tone: "secondary" },
  { label: "Pack contacts", value: "18", tone: "accent" },
  { label: "Collaborations", value: "3", tone: "muted" },
];

const attention = [
  {
    label: "Listing inquiries",
    detail: "3 animal listing threads need a brand response.",
    icon: MessageCircle,
    href: "/messages",
  },
  {
    label: "Litter family updates",
    detail: "Share a pack update for recent buyers and contract holders.",
    icon: HeartHandshake,
    href: "/compose",
  },
  {
    label: "Cross-brand post",
    detail: "Stone Creek Bullies collaboration is ready for announcement copy.",
    icon: Handshake,
    href: "/brand-os",
  },
];

const modules = [
  {
    label: "Content",
    meta: "Posts, reels, updates",
    count: "25",
    icon: FileText,
    href: "/brand-os",
  },
  {
    label: "Animals / Litters",
    meta: "Animal-first operating hub",
    count: "3",
    icon: PawPrint,
    href: "/b/blue-river-kennels",
  },
  {
    label: "Listings",
    meta: "Animal and product offers",
    count: "24",
    icon: BadgeDollarSign,
    href: "/brand-os",
  },
  {
    label: "Pack",
    meta: "Buyers, families, contracts",
    count: "18",
    icon: HeartHandshake,
    href: "/brand-os",
  },
  {
    label: "Messages",
    meta: "Inquiries with object context",
    count: "8",
    icon: MessageCircle,
    href: "/messages",
  },
  {
    label: "Promotions",
    meta: "Campaigns and boosted offers",
    count: "2",
    icon: Megaphone,
    href: "/brand-os",
  },
  {
    label: "Collaborations",
    meta: "Partner brands and shared posts",
    count: "3",
    icon: Handshake,
    href: "/brand-os",
  },
  {
    label: "Operators",
    meta: "People who can represent brand",
    count: "2",
    icon: UsersRound,
    href: "/brand-os",
  },
  {
    label: "Settings",
    meta: "Public brand identity",
    count: "OS",
    icon: Settings,
    href: "/brand-os",
  },
];

const attributionFlow = [
  { label: "Actor", value: "Jane" },
  { label: "Posting as", value: "Blue River Kennels" },
  { label: "Subject", value: "Biscuit" },
  { label: "Intent", value: "Animal listing" },
];

export default function BrandOSPage() {
  if (!brand) return null;

  return (
    <AppPage>
      <section className="px-3 pb-3 pt-4" data-testid="brand-os-header">
        <div className="premium-panel rounded-2xl p-4">
          <div className="flex items-start gap-3">
            <div className="grid size-16 shrink-0 place-items-center rounded-2xl border border-accent/35 bg-accent/15 text-accent">
              <Building2 className="size-7" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="eyebrow">Brand OS</p>
              <h1 className="mt-1 text-2xl font-semibold leading-tight">{brand.name}</h1>
              <p className="mt-1 truncate text-sm text-muted-foreground">{brand.handle}</p>
            </div>
            <Link
              href={`/b/${brand.slug}`}
              className="rounded-md border border-input px-3 py-2 text-sm font-medium text-brand-link"
            >
              Public
            </Link>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-2" data-testid="brand-os-overview">
            {overview.map((item) => (
              <div key={item.label} className="rounded-xl border border-border/70 bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-semibold">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="px-3 py-3" data-testid="brand-os-quick-actions">
        <p className="eyebrow mb-3">Quick actions</p>
        <div className="grid grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            return (
              <Link key={action.label} href={action.href} className="premium-panel rounded-2xl p-3 transition hover:border-primary/40">
                <span className="mb-4 grid size-9 place-items-center rounded-full bg-background/65 text-brand-link">
                  <Icon className="size-5" aria-hidden />
                </span>
                <span className="text-base font-semibold">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="px-3 py-3" data-testid="brand-os-attention">
        <div className="premium-panel rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-primary/35 bg-primary/15 text-brand-link">
              <Bell className="size-5" aria-hidden />
            </span>
            <div>
              <p className="eyebrow">Needs attention</p>
              <h2 className="text-lg font-semibold">Today&apos;s brand work</h2>
            </div>
          </div>
          <div className="grid gap-2">
            {attention.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.label}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-3 transition hover:border-primary/45 hover:bg-muted/45"
                >
                  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-background/35 text-muted-foreground">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{item.label}</span>
                    <span className="mt-1 block text-xs leading-5 text-muted-foreground">{item.detail}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="px-3 py-3" data-testid="brand-os-modules">
        <p className="eyebrow mb-3">Modules</p>
        <div className="grid grid-cols-2 gap-3">
          {modules.map((module) => {
            const Icon = module.icon;
            return (
              <Link key={module.label} href={module.href} className="premium-panel rounded-2xl p-3 transition hover:border-accent/45">
                <div className="flex items-start justify-between gap-2">
                  <span className="grid size-10 place-items-center rounded-xl border border-border/70 bg-muted/30 text-brand-link">
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <span className="rounded-md border border-border/70 bg-background/20 px-2 py-1 text-xs font-semibold text-muted-foreground">
                    {module.count}
                  </span>
                </div>
                <h2 className="mt-4 text-base font-semibold">{module.label}</h2>
                <p className="mt-1 min-h-10 text-xs leading-5 text-muted-foreground">{module.meta}</p>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="px-3 py-3" data-testid="brand-os-attribution">
        <div className="premium-panel rounded-2xl p-4">
          <div className="mb-3 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl border border-secondary/35 bg-secondary/20 text-secondary-foreground">
              <ShieldCheck className="size-5" aria-hidden />
            </span>
            <div>
              <p className="eyebrow">Attribution preview</p>
              <h2 className="text-lg font-semibold">How public content wraps</h2>
            </div>
          </div>
          <div className="grid gap-2">
            {attributionFlow.map((step, index) => (
              <div key={step.label} className="flex items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-3">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-background/35 text-sm font-semibold text-muted-foreground">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-muted-foreground">{step.label}</span>
                  <span className="block truncate text-sm font-semibold">{step.value}</span>
                </span>
              </div>
            ))}
          </div>
          <Link
            href="/compose"
            className="mt-4 flex min-h-12 items-center justify-center rounded-xl bg-secondary px-4 font-semibold text-secondary-foreground"
          >
            Open composer
          </Link>
        </div>
      </section>

      <section className="px-3 py-3">
        <div className="grid grid-cols-2 gap-3">
          <Link href="/shop" className="premium-panel rounded-2xl p-4">
            <ShoppingBag className="mb-4 size-5 text-brand-link" aria-hidden />
            <span className="block text-sm font-semibold">Shop lane</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">Product paths and recommendations</span>
          </Link>
          <Link href="/brand-os" className="premium-panel rounded-2xl p-4">
            <CalendarClock className="mb-4 size-5 text-brand-link" aria-hidden />
            <span className="block text-sm font-semibold">Schedule later</span>
            <span className="mt-1 block text-xs leading-5 text-muted-foreground">Drafts, campaigns, and reminders</span>
          </Link>
        </div>
      </section>
    </AppPage>
  );
}
