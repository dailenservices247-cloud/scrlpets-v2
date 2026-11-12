"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ShieldAlert,
  AlertTriangle,
  Scale,
} from "lucide-react";
import { createListing, editListing } from "@/lib/compose/actions";
import {
  REGULATORY_TIERS_META,
  lookupSpeciesProfile,
  verifySpeciesListingCompliance,
} from "@/lib/species/statutory-tiers";
import { cn } from "@/lib/utils";
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

const POPULAR_SPECIES = [
  { label: "Canine (Dog)", value: "Dog", icon: "🐶" },
  { label: "Feline (Cat)", value: "Cat", icon: "🐱" },
  { label: "Equine (Horse)", value: "Horse", icon: "🐎" },
  { label: "Lagomorph (Rabbit)", value: "Rabbit", icon: "🐰" },
  { label: "Reptile & Herp", value: "Ball Python", icon: "🐍" },
  { label: "Avian (Bird)", value: "Bird", icon: "🦜" },
  { label: "Livestock & Farm", value: "Goat", icon: "🐐" },
  { label: "Small Exotic", value: "Ferret", icon: "🦔" },
  { label: "Supplies & Gear", value: "Supplies", icon: "📦" },
];

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
        hasAnimal: boolean;
        depositPercent: string;
        inspectionHours: string;
        guarantee: GuaranteeChoice;
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
  const [depositPercent, setDepositPercent] = useState(edit?.depositPercent ?? "");
  const [inspectionHours, setInspectionHours] = useState(edit?.inspectionHours ?? "");
  const [guarantee, setGuarantee] = useState<GuaranteeChoice>(edit?.guarantee ?? EMPTY_GUARANTEE);
  const [sellerSource, setSellerSource] = useState<"distributor" | "merchant">("distributor");
  const [merchantName, setMerchantName] = useState("");
  const [externalSku, setExternalSku] = useState("");
  const [externalUrl, setExternalUrl] = useState("");
  const [saleMode, setSaleMode] = useState<"direct_checkout" | "contract_escrow">("direct_checkout");
  const [pendingGalleryPhotos, setPendingGalleryPhotos] = useState<
    { url: string; caption: string }[]
  >([]);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const compliance = verifySpeciesListingCompliance(category, title);
  const isProhibited = !compliance.allowed;
  const matchedProfile =
    compliance.profile ??
    lookupSpeciesProfile(category) ??
    (title ? lookupSpeciesProfile(title) : null);

  // Escrow & payout calculations
  const parsedPrice = parseFloat(price.replace(/[^0-9.]/g, ""));
  const hasValidPrice = !isNaN(parsedPrice) && parsedPrice > 0;
  const platformFee = hasValidPrice ? parsedPrice * 0.05 : 0;
  const netPayout = hasValidPrice ? parsedPrice - platformFee : 0;

  const parsedDeposit = parseFloat(depositPercent);
  const hasDeposit =
    hasValidPrice && !isNaN(parsedDeposit) && parsedDeposit > 0 && parsedDeposit <= 25;
  const depositAmount = hasDeposit ? (parsedPrice * parsedDeposit) / 100 : 0;
  const remainingBalance = hasDeposit ? parsedPrice - depositAmount : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (isProhibited) {
      setErr(compliance.notice ?? "This species is prohibited under federal wildlife statute.");
      return;
    }
    setBusy(true);
    setErr(null);
    const fd = new FormData();
    fd.set("title", title);
    fd.set("price", price);
    fd.set("mediaUrl", mediaUrl ?? "");
    fd.set("sellerSource", sellerSource);
    if (merchantName) fd.set("merchantName", merchantName);
    if (externalSku) fd.set("externalSku", externalSku);
    if (externalUrl) fd.set("externalUrl", externalUrl);
    fd.set("saleMode", creatureId ? "contract_escrow" : saleMode);
    let res;
    let createdId: string | undefined;
    if (edit) {
      if (edit.hasAnimal) {
        fd.set("depositPercent", depositPercent);
        fd.set("inspectionHours", inspectionHours);
        fd.set("guaranteeKind", guarantee.kind);
        if (guarantee.kind === "template") fd.set("guaranteeTemplate", guarantee.templateKey ?? "");
        if (guarantee.kind === "custom") {
          fd.set("guaranteeCustomTerms", guarantee.customTerms);
          fd.set("guaranteeCustomRemedy", guarantee.customRemedy);
          fd.set("guaranteeCustomDuration", guarantee.customDurationDays);
        }
      }
      res = await editListing(edit.id, fd);
    } else {
      if (creatureId) fd.set("creatureId", creatureId);
      fd.set("description", description);
      fd.set("category", category);
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
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-4 pt-4"
      data-testid={isEditing ? "edit-listing-form" : "listing-form"}
    >
      {/* Title */}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="listing-title-input" className="text-xs font-semibold text-muted-foreground">
          {t("titlePlaceholder")}
        </label>
        <input
          id="listing-title-input"
          className="rounded-xl border border-input bg-transparent p-2.5 text-sm transition focus:border-brand-link focus:outline-none"
          placeholder={t("titlePlaceholder")}
          aria-label={t("titlePlaceholder")}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          data-testid="listing-title"
        />
      </div>

      {/* Price & Escrow Fee Estimator */}
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="listing-price-input" className="text-xs font-semibold text-muted-foreground">
            {t("pricePlaceholder")}
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-2.5 text-sm font-semibold text-muted-foreground">
              $
            </span>
            <input
              id="listing-price-input"
              className="w-full rounded-xl border border-input bg-transparent py-2.5 pl-7 pr-3 text-sm transition focus:border-brand-link focus:outline-none"
              placeholder={t("pricePlaceholder")}
              aria-label={t("pricePlaceholder")}
              inputMode="decimal"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              data-testid="listing-price"
            />
          </div>
        </div>

        {/* Real-time Escrow & Net Payout Breakdown */}
        {hasValidPrice && (
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between text-muted-foreground">
              <span>Buyer Total:</span>
              <span className="font-semibold text-foreground">
                ${parsedPrice.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <span>Buyer Protection Guarantee (5%):</span>
              </span>
              <span>
                -${platformFee.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex items-center justify-between pt-1 border-t border-border/50 font-medium">
              <span className="text-foreground">Estimated Net Direct Deposit:</span>
              <span className="font-bold text-brand-link">
                ${netPayout.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {hasDeposit && (
              <div className="pt-1.5 border-t border-border/40 text-micro text-muted-foreground flex flex-wrap justify-between gap-1">
                <span>
                  Upfront Reservation ({parsedDeposit}%):{" "}
                  <strong className="text-foreground">
                    ${depositAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </span>
                <span>
                  Balance at Handover:{" "}
                  <strong className="text-foreground">
                    ${remainingBalance.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {!isEditing && (
        <>
          {/* Description */}
          <div className="flex flex-col gap-1.5">
            <label htmlFor="listing-description-input" className="text-xs font-semibold text-muted-foreground">
              {t("descriptionPlaceholder")}
            </label>
            <textarea
              id="listing-description-input"
              className="min-h-24 rounded-xl border border-input bg-transparent p-2.5 text-sm transition focus:border-brand-link focus:outline-none"
              placeholder={t("descriptionPlaceholder")}
              aria-label={t("descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              data-testid="listing-description"
            />
          </div>

          {/* Species & Taxonomy Classification */}
          <div className="flex flex-col gap-2">
            <label className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span>Species &amp; Classification</span>
              <span className="text-micro font-normal text-muted-foreground">
                Select category or type custom breed
              </span>
            </label>

            {/* Quick Pills */}
            <div className="flex flex-wrap gap-1.5 pb-0.5">
              {POPULAR_SPECIES.map((s) => {
                const isSelected =
                  category.toLowerCase() === s.value.toLowerCase() ||
                  (s.value === "Dog" && category.toLowerCase().includes("dog"));
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setCategory(s.value)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition border",
                      isSelected
                        ? "border-primary bg-primary/20 text-brand-link font-semibold shadow-xs"
                        : "border-border/70 bg-muted/30 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <span>{s.icon}</span>
                    <span>{s.label}</span>
                  </button>
                );
              })}
            </div>

            <input
              className="rounded-xl border border-input bg-transparent p-2.5 text-sm transition focus:border-brand-link focus:outline-none"
              placeholder={t("categoryPlaceholder")}
              aria-label={t("categoryPlaceholder")}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              data-testid="listing-category"
            />
          </div>

          {/* Dynamic Breeder Taxonomy & Statutory Identity Card */}
          {matchedProfile && (
            <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-lg bg-primary/20 text-xs font-bold text-brand-link">
                    {matchedProfile.tier}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {matchedProfile.name}{" "}
                      <span className="text-micro font-normal italic text-muted-foreground">
                        ({matchedProfile.scientificTaxa})
                      </span>
                    </p>
                    <p className="text-micro text-muted-foreground">
                      Tier {matchedProfile.tier}: {REGULATORY_TIERS_META[matchedProfile.tier].title.replace(/^Tier \d+: /, "")}
                    </p>
                  </div>
                </div>
                <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-micro font-semibold text-brand-link">
                  {matchedProfile.vocabulary.roleBadge} Classification
                </span>
              </div>

              {/* Breeder Vocabulary Breakdown */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-border/50 text-micro">
                <div className="rounded-lg bg-background/60 p-1.5 border border-border/40">
                  <span className="text-muted-foreground block">Offspring</span>
                  <span className="font-semibold text-foreground">{matchedProfile.vocabulary.youngTerm}</span>
                </div>
                <div className="rounded-lg bg-background/60 p-1.5 border border-border/40">
                  <span className="text-muted-foreground block">Group</span>
                  <span className="font-semibold text-foreground capitalize">{matchedProfile.vocabulary.youngGroup}</span>
                </div>
                <div className="rounded-lg bg-background/60 p-1.5 border border-border/40">
                  <span className="text-muted-foreground block">Lineage</span>
                  <span className="font-semibold text-foreground">
                    {matchedProfile.vocabulary.sireTerm} / {matchedProfile.vocabulary.damTerm}
                  </span>
                </div>
                <div className="rounded-lg bg-background/60 p-1.5 border border-border/40">
                  <span className="text-muted-foreground block">Classification</span>
                  <span className="font-semibold text-foreground">{matchedProfile.vocabulary.taxonomyLabel}</span>
                </div>
              </div>

              {/* Statutory Citation */}
              <div className="text-micro text-muted-foreground pt-0.5 flex items-start gap-1.5">
                <Scale className="size-3.5 shrink-0 mt-0.5 text-brand-link" />
                <span>
                  <strong>Statutory Basis:</strong> {matchedProfile.statutoryCitation}
                </span>
              </div>
            </div>
          )}
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

      {/* Media Upload */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground">Primary Cover Media</label>
        <MediaInput userId={userId} onUploaded={setMediaUrl} />
      </div>

      {/* Gallery Photos */}
      <div className="space-y-1">
        <label className="text-xs font-semibold text-muted-foreground">Additional Gallery Photos</label>
        <GalleryPhotosEditor
          userId={userId}
          listingId={edit?.id ?? null}
          onPendingPhotosChange={setPendingGalleryPhotos}
        />
      </div>

      {!isEditing && (
        <CreaturePicker creatures={creatures} value={creatureId} onChange={setCreatureId} />
      )}

      {!creatureId && !isEditing && (
        <div className="space-y-3 rounded-xl border border-input p-3" data-testid="merchant-options">
          <p className="eyebrow">Seller Channel</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setSellerSource("distributor")}
              className={`rounded-xl border p-2.5 text-left text-xs transition ${
                sellerSource === "distributor"
                  ? "border-primary/70 bg-primary/15 font-semibold text-brand-link"
                  : "border-border/70 bg-muted/30 text-muted-foreground"
              }`}
            >
              Independent Seller
            </button>
            <button
              type="button"
              onClick={() => setSellerSource("merchant")}
              className={`rounded-xl border p-2.5 text-left text-xs transition ${
                sellerSource === "merchant"
                  ? "border-primary/70 bg-primary/15 font-semibold text-brand-link"
                  : "border-border/70 bg-muted/30 text-muted-foreground"
              }`}
            >
              Store / Merchant
            </button>
          </div>

          {sellerSource === "merchant" && (
            <div className="grid gap-2 pt-1 sm:grid-cols-2">
              <input
                className="rounded border border-input bg-transparent p-2 text-sm"
                placeholder="Merchant name (e.g. Chewy, Petco, Local Store)"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
              />
              <input
                className="rounded border border-input bg-transparent p-2 text-sm"
                placeholder="Product SKU / Barcode"
                value={externalSku}
                onChange={(e) => setExternalSku(e.target.value)}
              />
              <input
                className="rounded border border-input bg-transparent p-2 text-sm sm:col-span-2"
                placeholder="External Catalog / Purchase URL (optional)"
                type="url"
                value={externalUrl}
                onChange={(e) => setExternalUrl(e.target.value)}
              />
            </div>
          )}

          <div className="pt-1">
            <label className="mb-1 block text-xs text-muted-foreground">Checkout Flow</label>
            <select
              value={saleMode}
              onChange={(e) => setSaleMode(e.target.value as "direct_checkout" | "contract_escrow")}
              className="w-full rounded border border-input bg-transparent p-2 text-xs"
            >
              <option value="direct_checkout">Direct Checkout (Instant Purchase)</option>
              <option value="contract_escrow">Protected Contract &amp; Held Deposit</option>
            </select>
          </div>
        </div>
      )}

      {/* Sale terms (deposit & inspection window) - shown for animal sales */}
      {((!isEditing && creatureId) || (isEditing && edit?.hasAnimal)) && (
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

      {((!isEditing && creatureId) || (isEditing && edit?.hasAnimal)) && (
        <GuaranteePicker value={guarantee} onChange={setGuarantee} />
      )}

      {/* Federal Prohibited Species Alert (Tier 6) */}
      {isProhibited && (
        <div
          className="rounded-xl border border-destructive/50 bg-destructive/10 p-3.5 text-xs text-destructive"
          data-testid="prohibited-species-alert"
        >
          <div className="flex items-center gap-2 font-bold">
            <ShieldAlert className="size-4 shrink-0" />
            <span>Federal Prohibition Notice (Tier 6)</span>
          </div>
          <p className="mt-1 leading-relaxed">{compliance.notice}</p>
          <a
            href="/guides/animal-legality"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1 font-semibold underline hover:opacity-80"
          >
            <Scale className="size-3.5" />
            <span>View Companion &amp; Exotic Animal Statutory Guide</span>
          </a>
        </div>
      )}

      {/* Statutory Advisory Disclaimer */}
      {!isProhibited && compliance.disclaimer && (
        <div
          className="rounded-xl border border-amber-600/40 bg-amber-600/10 p-3 text-xs text-amber-500"
          data-testid="compliance-disclaimer"
        >
          <div className="flex items-center gap-1.5 font-semibold">
            <AlertTriangle className="size-3.5 shrink-0" />
            <span>Statutory Advisory (Tier {compliance.tier})</span>
          </div>
          <p className="mt-1">{compliance.disclaimer}</p>
        </div>
      )}

      {err && <p className="text-destructive text-sm">{err}</p>}

      <Button
        type="submit"
        disabled={busy || disabled || isProhibited}
        data-testid="listing-submit"
      >
        {isEditing ? tc("saveChanges") : t("submitListing")}
      </Button>
    </form>
  );
}
