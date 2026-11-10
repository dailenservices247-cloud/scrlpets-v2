import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cookies } from "next/headers";
import { AppPage } from "@/components/app/AppPage";
import { NOTIFICATIONS_COOKIE } from "@/lib/settings/constants";
import { NotificationsForm } from "@/components/settings/NotificationsForm";

export const metadata = {
  title: "Notifications & Alerts Settings | Scrlpets",
  description: "Configure alerts for messages, escrow updates, gotcha days, and breeding reminders.",
};

export default async function NotificationsSettingsPage() {
  const store = await cookies();
  const rawNotifs = store.get(NOTIFICATIONS_COOKIE)?.value;

  let messages = true;
  let milestones = true;
  let packActivity = true;
  let sounds = true;

  if (rawNotifs) {
    try {
      const parsed = JSON.parse(rawNotifs);
      if (typeof parsed.messages === "boolean") messages = parsed.messages;
      if (typeof parsed.milestones === "boolean") milestones = parsed.milestones;
      if (typeof parsed.packActivity === "boolean") packActivity = parsed.packActivity;
      if (typeof parsed.sounds === "boolean") sounds = parsed.sounds;
    } catch {
      // Keep defaults
    }
  }

  return (
    <AppPage>
      <div className="p-4 sm:p-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Notifications & Alerts</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Choose which alerts you receive and control sound effects.
            </p>
          </div>
          <Link
            href="/settings"
            className="grid size-9 place-items-center rounded-xl border border-border/70 bg-card/60 text-muted-foreground transition hover:border-border hover:bg-muted/60 hover:text-foreground"
            aria-label="Back to settings"
          >
            <ArrowLeft className="size-4" aria-hidden />
          </Link>
        </header>

        <NotificationsForm
          initialMessages={messages}
          initialMilestones={milestones}
          initialPackActivity={packActivity}
          initialSounds={sounds}
        />
      </div>
    </AppPage>
  );
}
