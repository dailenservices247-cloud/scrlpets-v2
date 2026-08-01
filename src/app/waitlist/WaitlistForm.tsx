"use client";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { LITTER_SPECIES } from "@/lib/litters/constants";
import { joinWaitlist, type WaitlistState } from "@/lib/waitlist/actions";

export function WaitlistForm({ source }: { source: string }) {
  const t = useTranslations("waitlist");
  const speciesT = useTranslations("litters.species");
  const [state, formAction, pending] = useActionState<WaitlistState, FormData>(
    joinWaitlist,
    null,
  );

  if (state?.ok) {
    return (
      <div className="premium-panel rounded-2xl p-5" data-testid="waitlist-success">
        <h2 className="text-lg font-semibold">{t("successTitle")}</h2>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          {t("successBody")}
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="premium-panel relative rounded-2xl p-5"
      data-testid="waitlist-form"
    >
      <input type="hidden" name="source" value={source} />
      {/* Invisible to people; a filled value marks a script. */}
      <div
        aria-hidden="true"
        className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden"
      >
        <label>
          Company
          <input type="text" name="company" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      <label className="block text-sm font-medium" htmlFor="waitlist-email">
        {t("emailLabel")}
      </label>
      <input
        id="waitlist-email"
        name="email"
        type="email"
        required
        maxLength={320}
        placeholder={t("emailPlaceholder")}
        className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      {state?.error === "email" ? (
        <p className="mt-1 text-sm text-destructive">{t("errorEmail")}</p>
      ) : null}
      {state?.error === "server" ? (
        <p className="mt-1 text-sm text-destructive">{t("errorServer")}</p>
      ) : null}

      <fieldset className="mt-4">
        <legend className="text-sm font-medium">{t("speciesLegend")}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {LITTER_SPECIES.map((species) => (
            <label key={species} className="cursor-pointer">
              <input
                type="checkbox"
                name="species"
                value={species}
                className="peer sr-only"
              />
              <span className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm text-muted-foreground peer-checked:border-primary peer-checked:bg-primary/10 peer-checked:text-foreground">
                {speciesT(species)}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <Button type="submit" disabled={pending} className="mt-5 min-h-11 w-full">
        {pending ? t("submitting") : t("submit")}
      </Button>
      <p className="mt-3 text-xs leading-5 text-muted-foreground">{t("privacy")}</p>
    </form>
  );
}
