"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrand } from "@/lib/brands/actions";
import { capture } from "@/lib/analytics";
import { FUNNEL_EVENTS } from "@/lib/analytics/events";
import { Button } from "@/components/ui/button";

/**
 * Optional by construction. Skipping is a real answer that costs nothing, and
 * the copy says so — a breeder who is not ready must not feel gated.
 *
 * The brand type is fixed to `kennel`, which is the enum's breeding-program
 * value rather than a dog-shaped claim: it is never rendered back to the user
 * (only `CreateBrandForm`'s own select shows the labels), the species-facing
 * vocabulary comes from `speciesIdentity()` off the previous step, and the type
 * is editable later.
 */
export function BreederBranch({ nextPath }: { nextPath: string }) {
  const t = useTranslations("onboarding");
  const router = useRouter();
  const [asked, setAsked] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  function skip() {
    capture(FUNNEL_EVENTS.breederBranchSkipped);
    router.push(nextPath);
    router.refresh();
  }

  async function create() {
    if (!name.trim()) return; // The DB requires it; refuse before the round trip.
    setBusy(true);
    capture(FUNNEL_EVENTS.firstBrandCreated);
    const fd = new FormData();
    fd.set("name", name.trim());
    fd.set("brandType", "kennel");
    fd.set("next", nextPath);
    await createBrand(fd);
  }

  return (
    <section className="px-4 pb-10" data-testid="onboarding-breeder">
      <h1 className="text-2xl font-semibold tracking-tight">{t("breederTitle")}</h1>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{t("breederBody")}</p>

      {!asked ? (
        <>
          <Button
            className="mt-5 min-h-11 w-full"
            data-testid="breeder-yes"
            onClick={() => {
              capture(FUNNEL_EVENTS.breederBranchTaken);
              setAsked(true);
            }}
          >
            {t("breederYes")}
          </Button>
          <Button
            className="mt-2 min-h-11 w-full"
            variant="ghost"
            data-testid="breeder-skip"
            onClick={skip}
          >
            {t("breederNo")}
          </Button>
        </>
      ) : (
        <div className="mt-5">
          <label className="text-sm font-medium" htmlFor="breeder-name">
            {t("breederNameLabel")}
          </label>
          <input
            id="breeder-name"
            data-testid="breeder-name"
            className="mt-2 min-h-11 w-full rounded-xl border border-input bg-background px-3"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <p className="mt-2 text-xs text-muted-foreground">{t("breederNameHint")}</p>
          <Button
            className="mt-4 min-h-11 w-full"
            disabled={busy}
            data-testid="breeder-create"
            onClick={create}
          >
            {t("breederYes")}
          </Button>
          <Button
            className="mt-2 min-h-11 w-full"
            variant="ghost"
            disabled={busy}
            data-testid="breeder-skip"
            onClick={skip}
          >
            {t("breederNo")}
          </Button>
        </div>
      )}
    </section>
  );
}
