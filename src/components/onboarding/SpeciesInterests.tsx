"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { completeOnboarding } from "@/app/onboarding/actions";
import { LITTER_SPECIES } from "@/lib/litters/constants";
import { Button } from "@/components/ui/button";

/**
 * NOTHING is pre-selected. This app is for every animal kept as a pet, and a
 * pre-ticked "dog" would answer the question for the person before they read
 * it. The species vocabulary is the litter vocabulary — one list, one set of
 * labels, so an interest can never name a species the rest of the app cannot.
 */
export function SpeciesInterests({
  nextPath,
  initial,
}: {
  nextPath: string;
  initial: string[];
}) {
  const t = useTranslations("onboarding");
  const tSpecies = useTranslations("litters");
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(initial);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(species: string) {
    setSelected((current) =>
      current.includes(species)
        ? current.filter((value) => value !== species)
        : [...current, species],
    );
  }

  // Save and skip differ only in what they send: skip sends nothing.
  async function finish(species: string[]) {
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    for (const value of species) fd.append("species", value);
    const res = await completeOnboarding(fd);
    if (!res.ok) {
      setBusy(false);
      setErr(res.error ?? "error");
      return;
    }
    router.push(nextPath);
    router.refresh();
  }

  return (
    <section className="px-4 pb-10" data-testid="onboarding-species">
      <fieldset className="premium-panel rounded-2xl p-3">
        <legend className="sr-only">{t("legend")}</legend>
        <div className="flex flex-wrap gap-2">
          {LITTER_SPECIES.map((species) => {
            const active = selected.includes(species);
            return (
              <button
                key={species}
                type="button"
                aria-pressed={active}
                disabled={busy}
                data-testid={`onboarding-species-${species}`}
                onClick={() => toggle(species)}
                className={`min-h-11 rounded-xl border px-4 text-sm font-medium transition ${
                  active
                    ? "border-primary bg-primary/20 text-foreground"
                    : "border-input text-muted-foreground hover:bg-muted/60"
                }`}
              >
                {tSpecies(`species.${species}`)}
              </button>
            );
          })}
        </div>
      </fieldset>

      <p className="mt-3 text-xs leading-5 text-muted-foreground">{t("hint")}</p>
      {err && (
        <p className="mt-3 text-sm text-destructive" role="alert">
          {t("error")}
        </p>
      )}

      <Button
        className="mt-5 min-h-11 w-full"
        disabled={busy}
        onClick={() => finish(selected)}
        data-testid="onboarding-save"
      >
        {busy ? t("working") : t("save")}
      </Button>
      <Button
        className="mt-2 min-h-11 w-full"
        variant="ghost"
        disabled={busy}
        onClick={() => finish([])}
        data-testid="onboarding-skip"
      >
        {t("skip")}
      </Button>

      <p className="mt-6 text-center text-xs leading-5 text-muted-foreground">
        {t.rich("installLink", {
          install: (chunks) => (
            <Link href="/install" className="text-brand-link underline">
              {chunks}
            </Link>
          ),
        })}
      </p>
    </section>
  );
}
