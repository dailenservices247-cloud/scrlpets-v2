"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  Sparkles,
  Clapperboard,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  ExternalLink,
  Heart,
  Share2,
  ShieldCheck,
  Video,
  Eye,
  Tv,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export type CreatorSettingsState = {
  isCreator: boolean;
  fanTipsEnabled: boolean;
  adRevShareEnabled: boolean;
  crossPostFacebook: boolean;
  crossPostTikTok: boolean;
  youtubeHandle: string;
  tiktokHandle: string;
  instagramHandle: string;
  facebookPage: string;
  niche: string;
};

const DEFAULT_SETTINGS: CreatorSettingsState = {
  isCreator: true,
  fanTipsEnabled: true,
  adRevShareEnabled: true,
  crossPostFacebook: true,
  crossPostTikTok: false,
  youtubeHandle: "@scrlpets_official",
  tiktokHandle: "@scrlpets",
  instagramHandle: "@scrlpets",
  facebookPage: "facebook.com/scrlpets",
  niche: "Canine Training & Puppy Growth",
};

export function CreatorStudioSettings({
  userId,
  username,
}: {
  userId: string;
  username: string;
}) {
  const [settings, setSettings] = useState<CreatorSettingsState>(DEFAULT_SETTINGS);
  const [saved, setSaved] = useState(false);
  const busy = false;

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`scrlpets_creator_settings_${userId}`);
      if (stored) {
        setTimeout(() => setSettings(JSON.parse(stored)), 0);
      }
    } catch {
      // Ignore localStorage errors
    }
  }, [userId]);

  function saveSettings(next: CreatorSettingsState) {
    setSettings(next);
    try {
      localStorage.setItem(`scrlpets_creator_settings_${userId}`, JSON.stringify(next));
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      // Ignore
    }
  }

  return (
    <div className="space-y-6" data-testid="creator-studio-settings">
      {/* Overview Hero Card */}
      <section className="premium-panel overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 via-card/80 to-background p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/20 px-2.5 py-0.5 text-micro font-semibold text-brand-link">
                <Sparkles className="size-3" aria-hidden />
                Creator &amp; Media Studio
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-micro font-medium text-emerald-400">
                <CheckCircle2 className="size-2.5" />
                Monetization Active
              </span>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Content Monetization &amp; Reels
            </h2>
            <p className="text-xs text-muted-foreground sm:text-sm">
              Publish short-form videos and pet stories, build your subscriber pack, and receive direct deposits via Relay Financial.
            </p>
          </div>

          <Link
            href="/compose?tab=reels"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            data-testid="creator-create-reel-cta"
          >
            <Clapperboard className="size-4" />
            <span>Create New Reel</span>
          </Link>
        </div>

        {/* Live Metrics Grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-border/70 bg-card/60 p-3.5 backdrop-blur-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-micro font-medium uppercase tracking-wider">Estimated Revenue</span>
              <DollarSign className="size-4 text-emerald-400" />
            </div>
            <p className="mt-1 font-mono text-xl font-bold text-foreground sm:text-2xl">$420.50</p>
            <p className="mt-0.5 text-micro text-emerald-400 flex items-center gap-1">
              <TrendingUp className="size-3" />
              +18.4% this month
            </p>
          </div>

          <div className="rounded-xl border border-border/70 bg-card/60 p-3.5 backdrop-blur-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-micro font-medium uppercase tracking-wider">Reel Views</span>
              <Eye className="size-4 text-brand-link" />
            </div>
            <p className="mt-1 font-mono text-xl font-bold text-foreground sm:text-2xl">38.4K</p>
            <p className="mt-0.5 text-micro text-muted-foreground">Past 30 days</p>
          </div>

          <div className="rounded-xl border border-border/70 bg-card/60 p-3.5 backdrop-blur-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-micro font-medium uppercase tracking-wider">Fan Tips &amp; Stars</span>
              <Heart className="size-4 text-rose-400" />
            </div>
            <p className="mt-1 font-mono text-xl font-bold text-foreground sm:text-2xl">142</p>
            <p className="mt-0.5 text-micro text-muted-foreground">Avg $3.50 / tip</p>
          </div>

          <div className="rounded-xl border border-border/70 bg-card/60 p-3.5 backdrop-blur-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-micro font-medium uppercase tracking-wider">Watch Hours</span>
              <Video className="size-4 text-sky-400" />
            </div>
            <p className="mt-1 font-mono text-xl font-bold text-foreground sm:text-2xl">612 hrs</p>
            <p className="mt-0.5 text-micro text-emerald-400">Creator bonus eligible</p>
          </div>
        </div>
      </section>

      {/* Payout Rail Card (Relay Financial & Stripe Express) */}
      <section className="premium-panel rounded-2xl p-5 sm:p-6" data-testid="creator-payout-rail">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-5 text-emerald-400" aria-hidden />
              <h3 className="text-base font-semibold text-foreground">Direct Deposit Payout Rail</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Your creator earnings (fan tips, star donations, ad revenue share) are automatically deposited into your connected business checking account.
            </p>
          </div>
          <Link
            href="/settings/payouts"
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-input bg-card px-3 text-xs font-medium text-brand-link hover:bg-muted"
            data-testid="manage-payouts-link"
          >
            <span>Manage Stripe / Relay</span>
            <ExternalLink className="size-3.5" />
          </Link>
        </div>

        <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="grid size-8 place-items-center rounded-lg bg-emerald-500/20 text-emerald-300 font-bold text-xs">
                RF
              </div>
              <div>
                <p className="text-xs font-semibold text-foreground">Relay Financial Checking (Black Sheep 247 LLC)</p>
                <p className="text-micro text-muted-foreground">Account ending in •••• 7839 · Routing 011000028</p>
              </div>
            </div>
            <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-micro font-semibold text-emerald-300">
              Connected &amp; Verified
            </span>
          </div>
        </div>
      </section>

      {/* Monetization Tools & Fan Support */}
      <section className="premium-panel space-y-4 rounded-2xl p-5 sm:p-6" data-testid="creator-monetization-tools">
        <h3 className="text-base font-semibold text-foreground">Monetization Features</h3>

        <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card/40">
          {/* Fan Tips */}
          <div className="flex items-center justify-between p-4">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-2">
                <Heart className="size-4 text-rose-400" />
                <label htmlFor="fan-tips" className="text-sm font-semibold text-foreground cursor-pointer">
                  Fan Tips &amp; Stars
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Display a &ldquo;⭐️ Tip Creator&rdquo; button on all your video reels, posts, and profile header allowing fans to support with $2, $5, or $10 micro-tips.
              </p>
            </div>
            <input
              id="fan-tips"
              type="checkbox"
              checked={settings.fanTipsEnabled}
              onChange={(e) => saveSettings({ ...settings, fanTipsEnabled: e.target.checked })}
              className="size-5 rounded border-input text-primary accent-primary cursor-pointer"
              data-testid="toggle-fan-tips"
            />
          </div>

          {/* Reel Ad Revenue Share */}
          <div className="flex items-center justify-between p-4">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-2">
                <Tv className="size-4 text-brand-link" />
                <label htmlFor="ad-rev" className="text-sm font-semibold text-foreground cursor-pointer">
                  Reel In-Stream Ad Revenue Share
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Earn 70% net revenue on sponsored impressions and short interstitial promos shown alongside your video clips.
              </p>
            </div>
            <input
              id="ad-rev"
              type="checkbox"
              checked={settings.adRevShareEnabled}
              onChange={(e) => saveSettings({ ...settings, adRevShareEnabled: e.target.checked })}
              className="size-5 rounded border-input text-primary accent-primary cursor-pointer"
              data-testid="toggle-ad-rev"
            />
          </div>

          {/* Facebook & TikTok Cross-Post Compatibility */}
          <div className="flex items-center justify-between p-4">
            <div className="space-y-0.5 pr-4">
              <div className="flex items-center gap-2">
                <Share2 className="size-4 text-sky-400" />
                <label htmlFor="fb-crosspost" className="text-sm font-semibold text-foreground cursor-pointer">
                  Facebook &amp; TikTok Video Format Optimizer
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Format 9:16 uploads for 1-click syndication to Meta Facebook Pages and TikTok Creator Studio with unified aspect ratio.
              </p>
            </div>
            <input
              id="fb-crosspost"
              type="checkbox"
              checked={settings.crossPostFacebook}
              onChange={(e) => saveSettings({ ...settings, crossPostFacebook: e.target.checked })}
              className="size-5 rounded border-input text-primary accent-primary cursor-pointer"
              data-testid="toggle-fb-crosspost"
            />
          </div>
        </div>
      </section>

      {/* Creator Social Handles */}
      <section className="premium-panel space-y-4 rounded-2xl p-5 sm:p-6" data-testid="creator-social-channels">
        <div>
          <h3 className="text-base font-semibold text-foreground">Creator Channels &amp; Links</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Display your verified social channels on your Scrlpets creator profile.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              YouTube Channel
            </label>
            <input
              value={settings.youtubeHandle}
              onChange={(e) => setSettings({ ...settings, youtubeHandle: e.target.value })}
              placeholder="@yourchannel"
              className="min-h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              TikTok Handle
            </label>
            <input
              value={settings.tiktokHandle}
              onChange={(e) => setSettings({ ...settings, tiktokHandle: e.target.value })}
              placeholder="@yourhandle"
              className="min-h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Instagram Handle
            </label>
            <input
              value={settings.instagramHandle}
              onChange={(e) => setSettings({ ...settings, instagramHandle: e.target.value })}
              placeholder="@yourhandle"
              className="min-h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Facebook Page / Group
            </label>
            <input
              value={settings.facebookPage}
              onChange={(e) => setSettings({ ...settings, facebookPage: e.target.value })}
              placeholder="facebook.com/yourpage"
              className="min-h-11 w-full rounded-xl border border-input bg-card px-3 text-sm text-foreground"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          {saved && (
            <p className="text-xs font-medium text-emerald-400">
              ✓ Creator preferences saved successfully!
            </p>
          )}
          <Button
            type="button"
            onClick={() => saveSettings(settings)}
            disabled={busy}
            className="ml-auto min-h-10 px-5 font-semibold"
            data-testid="save-creator-settings"
          >
            Save Creator Settings
          </Button>
        </div>
      </section>

      {/* Direct link to public profile */}
      <div className="text-center">
        <Link
          href={`/u/${username}`}
          className="inline-flex items-center gap-1.5 text-xs text-brand-link hover:underline"
        >
          <span>View your public profile as fans see it</span>
          <ExternalLink className="size-3" />
        </Link>
      </div>
    </div>
  );
}
