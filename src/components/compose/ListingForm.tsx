"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createListing, editListing } from "@/lib/compose/actions";
import { applyAttribution } from "./attribution";
import type { ComposeAttribution } from "./ComposerTabs";
import { MediaInput } from "./MediaInput";
import { CreaturePicker } from "./CreaturePicker";
import { Button } from "@/components/ui/button";
import { capture } from "@/lib/analytics";

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
    if (edit) {
      res = await editListing(edit.id, fd);
    } else {
      if (creatureId) fd.set("creatureId", creatureId);
      fd.set("description", description);
      fd.set("category", category);
      if (creatureId && isAdoption) fd.set("listingKind", "adoption");
      applyAttribution(fd, attribution!);
      res = await createListing(fd);
    }
    setBusy(false);
    if (!res.ok) {
      setErr(res.error === "price" ? t("errorPrice") : t("errorRequired"));
      return;
    }
    if (edit) {
      capture("content_edited", { content_type: "listing", has_media: !!mediaUrl });
      router.push(edit.returnPath);
    } else {
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
      {err && <p className="text-destructive text-sm">{err}</p>}
      <Button type="submit" disabled={busy || disabled} data-testid="listing-submit">
        {isEditing ? tc("saveChanges") : t("submitListing")}
      </Button>
    </form>
  );
}
