import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cookies } from "next/headers";
import { AppPage } from "@/components/app/AppPage";
import { getSessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";
import { LOCALE_COOKIE, resolveLocale } from "@/lib/i18n/locale";
import { PREFERENCES_COOKIE } from "@/lib/settings/constants";
import { PreferencesForm } from "@/components/settings/PreferencesForm";

export const metadata = {
  title: "Preferences & Regional Settings | Scrlpets",
  description: "Customize language, measurement units, time formats, and species focus.",
};

export default async function PreferencesSettingsPage() {
  const user = await getSessionUser();
  const store = await cookies();
  const currentLocale = resolveLocale(store.get(LOCALE_COOKIE)?.value);

  let initialUnits: "imperial" | "metric" = "imperial";
  let initialTimeFormat: "12h" | "24h" = "12h";
  let initialAutoplay: "always" | "wifi" | "never" = "always";

  const rawPrefs = store.get(PREFERENCES_COOKIE)?.value;
  if (rawPrefs) {
    try {
      const parsed = JSON.parse(rawPrefs);
      if (parsed.units) initialUnits = parsed.units;
      if (parsed.timeFormat) initialTimeFormat = parsed.timeFormat;
      if (parsed.autoplayMedia) initialAutoplay = parsed.autoplayMedia;
    } catch {
      // Keep defaults
    }
  }

  let userSpecies: string[] = [];
  if (user) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("profiles")
      .select("species_interests")
      .eq("id", user.id)
      .maybeSingle();
    userSpecies = (data?.species_interests as string[] | null) ?? [];
  }

  return (
    <AppPage>
      <div className="p-4 sm:p-6">
        <header className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Preferences & Regional</h1>
            <p className="mt-1 text-xs text-muted-foreground">
              Customize language, measurement units, and personalized animal focus.
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

        <PreferencesForm
          currentLocale={currentLocale}
          initialUnits={initialUnits}
          initialTimeFormat={initialTimeFormat}
          initialAutoplay={initialAutoplay}
          initialSpecies={userSpecies}
        />
      </div>
    </AppPage>
  );
}
