"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createListing } from "@/lib/compose/actions";
import { applyAttribution } from "./attribution";
import type { ComposeAttribution } from "./ComposerTabs";
import { MediaInput } from "./MediaInput";
import { CreaturePicker } from "./CreaturePicker";
import { Button } from "@/components/ui/button";
import { capture } from "@/lib/analytics";

export function ListingForm({
  userId,
  creatures,
  attribution,
  disabled = false,
}: {
  userId: string;
  creatures: { id: string; name: string }[];
  attribution: ComposeAttribution;
  disabled?: boolean;
}) {
  const t = useTranslations("compose");
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [price, setPrice] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [creatureId, setCreatureId] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("price", price);
    if (mediaUrl) fd.set("mediaUrl", mediaUrl);
    if (creatureId) fd.set("creatureId", creatureId);
    applyAttribution(fd, attribution, creatureId);
    const res = await createListing(fd);
    setBusy(false);
    if (!res.ok) {
      setErr(res.error === "price" ? t("errorPrice") : t("errorRequired"));
      return;
    }
    capture("listing_created", { has_media: !!mediaUrl, has_creature: !!creatureId });
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4 pt-4" data-testid="listing-form">
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
      <MediaInput userId={userId} onUploaded={setMediaUrl} />
      <CreaturePicker creatures={creatures} value={creatureId} onChange={setCreatureId} />
      {err && <p className="text-destructive text-sm">{err}</p>}
      <Button type="submit" disabled={busy || disabled} data-testid="listing-submit">
        {t("submitListing")}
      </Button>
    </form>
  );
}
