"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createListing, editListing } from "@/lib/compose/actions";
import { applyAttribution } from "./attribution";
import type { ComposeAttribution } from "./ComposerTabs";
import { MediaInput } from "./MediaInput";
import { CreaturePicker } from "./CreaturePicker";
import { GuaranteePicker, EMPTY_GUARANTEE, type GuaranteeChoice } from "./GuaranteePicker";
import { GalleryPhotosEditor } from "@/components/listing/GalleryPhotosEditor";
import { addListingPhotos } from "@/lib/listings/actions";
import { Button } from "@/components/ui/button";
import { capture } from "@/lib/analytics";

/**
 * The animal-listing gate refuses at the row level, so it surfaces as a Postgres
 * policy error rather than a named code. Matching on that is unlovely, but the
 * alternative shipped for months: telling a verified-blocked seller their form
 * was incomplete. Narrow the match if createListing ever returns a real code.
 */
function isSellerGateError(error: string): boolean {
  const e = error.toLowerCase();
  return (
    e.includes("row-level security") ||
    e.includes("violates row-level") ||
    e.includes("42501") ||
    e.includes("new row violates")
  );
}

type ListingFormProps =
  | {
      userId: string;
      creatures: { id: string; name: string }[];
      attribution: ComposeAttribution;
      disabled?: boolean;
      edit?: never;
    }
  | {
      userId: string;
      edit: {
        id: string;
        title: string;
        price: string;
        mediaUrl: string | null;
        returnPath: string;
      };
      creatures?: never;
      attribution?: never;
      disabled?: never;
    };

export function ListingForm(props: ListingFormProps) {
  const { userId } = props;
  const edit = props.edit;
  const creatures = props.creatures ?? [];
  const attribution = props.attribution;
  const disabled = props.disabled ?? false;
  const isEditing = Boolean(edit);
  const t = useTranslations("compose");
  const tc = useTranslations("content");
  const router = useRouter();
  const [title, setTitle] = useState(edit?.title ?? "");
  const [price, setPrice] = useState(edit?.price ?? "");
  const [mediaUrl, setMediaUrl] = useState<string | null>(edit?.mediaUrl ?? null);
  const [creatureId, setCreatureId] = useState<string | null>(null);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [isAdoption, setIsAdoption] = useState(false);
  const [depositPercent, setDepositPercent] = useState("");
  const [inspectionHours, setInspectionHours] = useState("");
  const [guarantee, setGuarantee] = useState<GuaranteeChoice>(EMPTY_GUARANTEE);
  const [pendingGalleryPhotos, setPendingGalleryPhotos] = useState<
    { url: string; caption: string }[]
  >([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("price", price);
    fd.set("mediaUrl", mediaUrl ?? "");
    let res;
    let createdId: string | undefined;
    if (edit) {
      res = await editListing(edit.id, fd);
    } else {
      if (creatureId) fd.set("creatureId", creatureId);
      fd.set("description", description);
      fd.set("category", category);
      if (creatureId && isAdoption) fd.set("listingKind", "adoption");
      fd.set("depositPercent", depositPercent);
      fd.set("inspectionHours", inspectionHours);
      fd.set("guaranteeKind", guarantee.kind);
      if (guarantee.kind === "template") fd.set("guaranteeTemplate", guarantee.templateKey ?? "");
      if (guarantee.kind === "custom") {
        fd.set("guaranteeCustomTerms", guarantee.customTerms);
        fd.set("guaranteeCustomRemedy", guarantee.customRemedy);
        fd.set("guaranteeCustomDuration", guarantee.customDurationDays);
      }
      applyAttribution(fd, attribution!);
      const created = await createListing(fd);
      createdId = created.ok ? created.id : undefined;
      res = created;
    }
    setBusy(false);
    if (!res.ok) {
      // Do NOT collapse every failure into "required fields are missing".
      // Attaching an animal is gated on the seller being identity-verified, and
      // that refusal arrives as an RLS error — reported as a form problem, it
      // sent sellers back to re-check fields that were never the issue, forever.
      // The gate is real; the honest thing is to name it.
      // Each sale-term refusal names itself. Collapsing them into
      // "required fields are missing" is the same mistake the seller gate
      // taught: a seller who typed 40% would be told to re-check fields that
      // were never the problem.
      const termErrors: Record<string, string> = {
        deposit_too_large: t("errorDepositTooLarge"),
        deposit_invalid: t("errorDepositInvalid"),
        inspection_too_short: t("errorInspectionTooShort"),
        guarantee_incomplete: t("errorGuaranteeIncomplete"),
        inspection_too_long: t("errorInspectionTooLong"),
        inspection_invalid: t("errorInspectionInvalid"),
      };
      setErr(
        res.error === "price"
          ? t("errorPrice")
          : termErrors[res.error ?? ""]
            ? termErrors[res.error!]
            : isSellerGateError(res.error)
              ? t("errorSellerUnverified")
              : t("errorRequired"),
      );
      return;
    }
    if (edit) {
      capture("content_edited", { content_type: "listing", has_media: !!mediaUrl });
      router.push(edit.returnPath);
    } else {
      if (pendingGalleryPhotos.length > 0 && createdId) {
        await addListingPhotos(createdId, pendingGalleryPhotos);
      }
      capture("listing_created", { has_media: !!mediaUrl, has_creature: !!creatureId });
      router.push("/");
    }
    router.refresh();
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 pt-4"
      data-testid={isEditing ? "edit-listing-form" : "listing-form"}
    >
      <input
        className="rounded border border-input bg-transparent p-2"
        placeholder={t("titlePlaceholder")}
        aria-label={t("titlePlaceholder")}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        data-testid="listing-title"
      />
      <input
        className="rounded border border-input bg-transparent p-2"
        placeholder={t("pricePlaceholder")}
        aria-label={t("pricePlaceholder")}
        inputMode="decimal"
        value={price}
        onChange={(e) => setPrice(e.target.value)}
        data-testid="listing-price"
      />
      {!isEditing && (
        <>
          <textarea
            className="min-h-24 rounded border border-input bg-transparent p-2"
            placeholder={t("descriptionPlaceholder")}
            aria-label={t("descriptionPlaceholder")}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            data-testid="listing-description"
          />
          <input
            className="rounded border border-input bg-transparent p-2"
            placeholder={t("categoryPlaceholder")}
            aria-label={t("categoryPlaceholder")}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            data-testid="listing-category"
          />
        </>
      )}
      {isEditing && mediaUrl && (
        <div className="rounded-xl border border-border/70 p-3" data-testid="current-media">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={mediaUrl} alt="" className="max-h-56 w-full rounded-lg object-cover" />
          <Button type="button" variant="outline" className="mt-3" onClick={() => setMediaUrl(null)}>
            {tc("removePhoto")}
          </Button>
        </div>
      )}
      <MediaInput userId={userId} onUploaded={setMediaUrl} />
      <GalleryPhotosEditor
        userId={userId}
        listingId={edit?.id ?? null}
        onPendingPhotosChange={setPendingGalleryPhotos}
      />
      {!isEditing && (
        <CreaturePicker creatures={creatures} value={creatureId} onChange={setCreatureId} />
      )}
      {!isEditing && creatureId && (
        <label className="flex items-start gap-3 rounded-xl border border-input p-3">
          <input
            type="checkbox"
            checked={isAdoption}
            onChange={(e) => setIsAdoption(e.target.checked)}
            data-testid="listing-adoption"
            className="mt-0.5 size-4"
          />
          <span className="text-sm">
            <span className="font-medium">{t("adoptionLabel")}</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">{t("adoptionHelp")}</span>
          </span>
        </label>
      )}
      {!isEditing && creatureId && !isAdoption && (
        <div className="grid gap-3 rounded-xl border border-input p-3 sm:grid-cols-2" data-testid="sale-terms">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("depositLabel")}</span>
            <input
              type="number"
              min={0}
              max={25}
              step="0.5"
              inputMode="decimal"
              className="rounded border border-input bg-transparent p-2"
              value={depositPercent}
              onChange={(e) => setDepositPercent(e.target.value)}
              data-testid="listing-deposit"
              aria-describedby="deposit-help"
            />
            <span id="deposit-help" className="text-xs text-muted-foreground">
              {t("depositHelp")}
            </span>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium">{t("inspectionLabel")}</span>
            <input
              type="number"
              min={24}
              max={336}
              step={1}
              inputMode="numeric"
              className="rounded border border-input bg-transparent p-2"
              value={inspectionHours}
              onChange={(e) => setInspectionHours(e.target.value)}
              data-testid="listing-inspection-hours"
              aria-describedby="inspection-help"
            />
            <span id="inspection-help" className="text-xs text-muted-foreground">
              {t("inspectionHelp")}
            </span>
          </label>
        </div>
      )}
      {!isEditing && creatureId && !isAdoption && (
        <GuaranteePicker value={guarantee} onChange={setGuarantee} />
      )}
      {err && <p className="text-destructive text-sm">{err}</p>}
      <Button type="submit" disabled={busy || disabled} data-testid="listing-submit">
        {isEditing ? tc("saveChanges") : t("submitListing")}
      </Button>
    </form>
  );
}
