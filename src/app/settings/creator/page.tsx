import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getSessionUser } from "@/lib/auth/session";
import { AppPage } from "@/components/app/AppPage";
import { CreatorStudioSettings } from "@/components/creator/CreatorStudioSettings";

export const metadata = {
  title: "Creator Studio & Monetization | Scrlpets",
  description: "Manage your video reels, fan tips, monetization channels, and direct deposits via Relay Financial.",
};

export default async function CreatorSettingsPage() {
  const user = (await getSessionUser())!; // middleware gates /settings
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .single();

  return (
    <AppPage>
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Creator Studio &amp; Monetization
            </h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Configure your creator profile, video reels monetization, fan tipping, and Relay Financial direct deposits.
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

        <CreatorStudioSettings userId={user.id} username={data?.username ?? "creator"} />
      </div>
    </AppPage>
  );
}
