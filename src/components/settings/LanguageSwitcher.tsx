"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { setLocale } from "@/lib/i18n/actions";
import { LOCALES, type Locale } from "@/lib/i18n/locale";

/**
 * Spanish shipped dictionary-complete and unreachable — 1775 keys with no way
 * to select them. This is the way.
 *
 * Cookie-backed, so a signed-out visitor can read the app in Spanish before
 * they have an account. Public discovery without registration is a locked
 * strength; a language wall in front of it would undo part of that.
 */
export function LanguageSwitcher({ current }: { current: Locale }) {
  const t = useTranslations("settings");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<Locale>(current);

  const label: Record<Locale, string> = {
    en: t("languageEnglish"),
    // Named in its OWN language: someone who needs Spanish cannot necessarily
    // read "Spanish" to find it.
    es: t("languageSpanish"),
  };

  return (
    <div className="flex flex-col gap-2" data-testid="language-switcher">
      <p className="eyebrow">{t("languageHeading")}</p>
      <div className="flex flex-wrap gap-2">
        {LOCALES.map((locale) => (
          <button
            key={locale}
            type="button"
            disabled={pending}
            aria-pressed={chosen === locale}
            data-testid={`language-${locale}`}
            className={
              chosen === locale
                ? "min-h-11 flex-1 rounded-xl bg-secondary/25 px-4 text-sm font-medium text-secondary-foreground disabled:opacity-50"
                : "min-h-11 flex-1 rounded-xl border border-input px-4 text-sm font-medium disabled:opacity-50"
            }
            onClick={() => {
              setChosen(locale);
              startTransition(async () => {
                await setLocale(locale);
                router.refresh();
              });
            }}
          >
            {pending && chosen === locale ? t("languageSaving") : label[locale]}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">{t("languageHelp")}</p>
    </div>
  );
}
