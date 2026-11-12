"use client";

import { useState, useTransition } from "react";
import { Bell, MessageSquare, ShieldCheck, Sparkles, Volume2, Check } from "lucide-react";
import { saveNotificationSettings } from "@/lib/settings/actions";
import { cn } from "@/lib/utils";

export function NotificationsForm({
  initialMessages = true,
  initialMilestones = true,
  initialPackActivity = true,
  initialSounds = true,
}: {
  initialMessages?: boolean;
  initialMilestones?: boolean;
  initialPackActivity?: boolean;
  initialSounds?: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [milestones, setMilestones] = useState(initialMilestones);
  const [packActivity, setPackActivity] = useState(initialPackActivity);
  const [sounds, setSounds] = useState(initialSounds);
  const [savedNotice, setSavedNotice] = useState(false);
  const [pending, startTransition] = useTransition();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData();
    if (messages) fd.set("messages", "on");
    if (milestones) fd.set("milestones", "on");
    if (packActivity) fd.set("packActivity", "on");
    if (sounds) fd.set("sounds", "on");

    startTransition(async () => {
      await saveNotificationSettings(fd);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6" data-testid="notifications-form">
      {savedNotice && (
        <div
          className="flex items-center gap-2 rounded-xl border border-secondary/40 bg-secondary/15 p-3.5 text-xs font-semibold text-secondary-foreground"
          role="status"
        >
          <Check className="size-4 shrink-0" />
          <span>Notification preferences saved.</span>
        </div>
      )}

      {/* 1. Transaction & Payment Protection (Always On) */}
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/15 text-brand-link">
              <ShieldCheck className="size-4.5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">Order, Security & Payment Protection Alerts</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Critical notifications regarding held deposit release, carrier transport pickup, dispute arbitration, and Stripe payouts.
              </p>
            </div>
          </div>
          <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-0.5 text-micro font-bold text-brand-link shrink-0">
            Mandatory
          </span>
        </div>
      </section>

      {/* 2. Messages & Inquiries */}
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary/15 text-secondary-foreground">
              <MessageSquare className="size-4.5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">Direct Messages & Deal Room Inquiries</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Alerts when prospective buyers, adopters, or breeding partners message you.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMessages(!messages)}
            role="switch"
            aria-checked={messages}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-hidden",
              messages ? "bg-primary" : "bg-muted"
            )}
            data-testid="toggle-messages-notif"
          >
            <span
              className={cn(
                "inline-block size-5 transform rounded-full bg-white shadow-xs transition duration-200",
                messages ? "translate-x-5.5" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      </section>

      {/* 3. Milestones & Health */}
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-foreground">
              <Sparkles className="size-4.5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">Pet Milestones & Health Care Reminders</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Gotcha day celebrations, litter growth weigh-in alerts, vaccination schedules, and care logs.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setMilestones(!milestones)}
            role="switch"
            aria-checked={milestones}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-hidden",
              milestones ? "bg-primary" : "bg-muted"
            )}
            data-testid="toggle-milestones-notif"
          >
            <span
              className={cn(
                "inline-block size-5 transform rounded-full bg-white shadow-xs transition duration-200",
                milestones ? "translate-x-5.5" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      </section>

      {/* 4. Pack Activity */}
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-muted text-foreground">
              <Bell className="size-4.5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">Pack Activity & Mentions</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Updates from kennels, catteries, and packs you follow, plus comments on your posts.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setPackActivity(!packActivity)}
            role="switch"
            aria-checked={packActivity}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-hidden",
              packActivity ? "bg-primary" : "bg-muted"
            )}
            data-testid="toggle-pack-notif"
          >
            <span
              className={cn(
                "inline-block size-5 transform rounded-full bg-white shadow-xs transition duration-200",
                packActivity ? "translate-x-5.5" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      </section>

      {/* 5. Sound & Haptics */}
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-brand-link">
              <Volume2 className="size-4.5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">In-App Notification Sounds</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Play subtle sound chime when receiving incoming deal inquiries and messages.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSounds(!sounds)}
            role="switch"
            aria-checked={sounds}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-hidden",
              sounds ? "bg-primary" : "bg-muted"
            )}
            data-testid="toggle-sounds-notif"
          >
            <span
              className={cn(
                "inline-block size-5 transform rounded-full bg-white shadow-xs transition duration-200",
                sounds ? "translate-x-5.5" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      </section>

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="min-h-11 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-xs transition hover:opacity-90 disabled:opacity-50"
          data-testid="save-notifications-btn"
        >
          {pending ? "Saving..." : "Save Preferences"}
        </button>
      </div>
    </form>
  );
}
