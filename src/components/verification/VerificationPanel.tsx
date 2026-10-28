"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  BadgeCheck,
  Building2,
  Clock,
  Lock,
  Scale,
  ShieldAlert,
  ShieldCheck,
  Truck,
} from "lucide-react";
import {
  attestAnimalEligibility,
  attestBuyerReadiness,
  startIdentityVerification,
  submitSellerProgram,
} from "@/lib/verification/actions";
import type { SellerProgram, TrustState } from "@/lib/verification/queries";
import type { StandingPolicy, SellerComplianceProfile } from "@/lib/contracts/queries";
import { saveStandingPolicy, saveComplianceProfile } from "@/lib/contracts/actions";

const PROGRAM_TYPES = ["kennel", "business", "rescue", "usda", "breed_club"] as const;

function StatusChip({ status }: { status: TrustState["identity"] }) {
  const t = useTranslations("verification");
  const map = {
    verified: { icon: ShieldCheck, cls: "text-secondary-foreground bg-secondary/25" },
    pending: { icon: Clock, cls: "text-muted-foreground bg-muted/45" },
    failed: { icon: ShieldAlert, cls: "text-destructive bg-destructive/10" },
    canceled: { icon: ShieldAlert, cls: "text-muted-foreground bg-muted/45" },
    none: { icon: ShieldAlert, cls: "text-muted-foreground bg-muted/45" },
  } as const;
  const { icon: Icon, cls } = map[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${cls}`}
      data-testid="identity-status"
      data-status={status}
    >
      <Icon className="size-3.5" aria-hidden />
      {t(`identityStatus.${status}`)}
    </span>
  );
}

export function VerificationPanel({
  state,
  creatures,
  attestedIds,
  identityConfigured,
  standingPolicy,
  complianceProfile,
}: {
  state: TrustState;
  creatures: { id: string; name: string }[];
  attestedIds: string[];
  identityConfigured: boolean;
  standingPolicy?: StandingPolicy | null;
  complianceProfile?: SellerComplianceProfile | null;
}) {
  const t = useTranslations("verification");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const attested = new Set(attestedIds);

  const [showComplianceForm, setShowComplianceForm] = useState(!complianceProfile);
  const [showPolicyForm, setShowPolicyForm] = useState(!standingPolicy);
  const [depositPolicy, setDepositPolicy] = useState(
    standingPolicy?.depositRefundablePolicy ?? "escrow_until_handover"
  );
  const [depositPercent, setDepositPercent] = useState(
    standingPolicy?.defaultDepositBps ? Math.round(standingPolicy.defaultDepositBps / 100) : 20
  );
  const [policyTerms, setPolicyTerms] = useState(
    standingPolicy?.contractDisclosureTerms ??
      "Standard veterinary health inspection within 72 hours required. Vaccination records provided upon handover."
  );

  const isPolicyLocked = standingPolicy?.lockedUntil
    ? new Date(standingPolicy.lockedUntil) > new Date()
    : false;

  async function startIdentity() {
    setBusy("identity");
    setError(null);
    const result = await startIdentityVerification(`${window.location.origin}/settings/verification`);
    setBusy(null);
    if (!result.ok) {
      setError(result.error === "not_configured" ? t("error.notConfigured") : t("error.generic"));
      return;
    }
    if (result.redirectUrl) window.location.href = result.redirectUrl;
  }

  return (
    <div className="flex flex-col gap-4" data-testid="verification-panel">
      {notice && (
        <p className="rounded-xl border border-secondary/35 bg-secondary/10 p-3 text-sm" role="status">
          {notice}
        </p>
      )}
      {error && (
        <p className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* Identity — D1/D5: the vendor holds the documents, we hold a status. */}
      <section className="premium-panel rounded-2xl p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold">{t("identityTitle")}</h2>
          <StatusChip status={state.identity} />
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">{t("identityBody")}</p>
        {state.identity !== "verified" && (
          <button
            type="button"
            onClick={startIdentity}
            disabled={busy === "identity" || !identityConfigured}
            data-testid="start-identity"
            className="mt-3 min-h-11 rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link disabled:opacity-50"
          >
            {busy === "identity" ? t("working") : t("startIdentity")}
          </button>
        )}
        {!identityConfigured && (
          <p className="mt-2 text-xs text-muted-foreground" data-testid="identity-not-configured">
            {t("error.notConfigured")}
          </p>
        )}
      </section>

      {/* Program credential — reference only, admin reviewed. */}
      <section className="premium-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">{t("programTitle")}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("programBody")}</p>
        {state.programs.length > 0 && (
          <ul className="mt-3 flex flex-col gap-2" data-testid="program-list">
            {state.programs.map((p: SellerProgram) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/25 p-3 text-sm"
                data-testid="program-row"
                data-status={p.status}
              >
                <span className="min-w-0">
                  <span className="block font-medium">{t(`programType.${p.programType}`)}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {p.issuingAuthority} · {p.credentialNumber}
                  </span>
                  {/* The whole applicant-facing half of a rejection. A code
                      from a fixed set — never the reviewer's note, which the
                      client role cannot read at all. */}
                  {p.status === "rejected" && p.rejectionReason && (
                    <span
                      className="mt-1 block text-xs text-muted-foreground"
                      data-testid="program-rejection-reason"
                      data-reason={p.rejectionReason}
                    >
                      {t(`rejectionReason.${p.rejectionReason}`)}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs font-medium">{t(`programStatus.${p.status}`)}</span>
              </li>
            ))}
          </ul>
        )}
        <form
          className="mt-3 flex flex-col gap-2"
          action={async (fd) => {
            setBusy("program");
            setError(null);
            const result = await submitSellerProgram(fd);
            setBusy(null);
            if (result.ok) {
              setNotice(t("notice.programSubmitted"));
              router.refresh();
            } else setError(t("error.generic"));
          }}
        >
          <select
            name="programType"
            required
            aria-label={t("programTypeLabel")}
            data-testid="program-type"
            className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
          >
            {PROGRAM_TYPES.map((type) => (
              <option key={type} value={type}>
                {t(`programType.${type}`)}
              </option>
            ))}
          </select>
          <input
            name="issuingAuthority"
            required
            placeholder={t("issuingAuthority")}
            aria-label={t("issuingAuthority")}
            data-testid="program-authority"
            className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
          />
          <input
            name="credentialNumber"
            required
            placeholder={t("credentialNumber")}
            aria-label={t("credentialNumber")}
            data-testid="program-number"
            className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
          />
          <input
            name="publicUrl"
            type="url"
            placeholder={t("publicUrl")}
            aria-label={t("publicUrl")}
            data-testid="program-url"
            className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
          />
          <button
            type="submit"
            disabled={busy === "program"}
            data-testid="program-submit"
            className="min-h-11 rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link disabled:opacity-50"
          >
            {busy === "program" ? t("working") : t("submitProgram")}
          </button>
        </form>
      </section>

      {/* Module 5: Legal Entity & Compliance Vault */}
      <section className="premium-panel rounded-2xl p-4" data-testid="compliance-vault-section">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-brand-link" aria-hidden />
            <h2 className="text-sm font-semibold">Legal Entity & Compliance Vault</h2>
          </div>
          {complianceProfile && (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/25 px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
              <ShieldCheck className="size-3" aria-hidden />
              Verified Entity
            </span>
          )}
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Legally registered business entities and carrier authorities unlock Counterparty Protection Dossiers and Verified Store badges, shielding your transactions with immutable legal standing.
        </p>

        {complianceProfile && !showComplianceForm && (
          <div className="mt-3 space-y-1.5 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">{complianceProfile.legalEntityName}</span>
              <span className="font-mono text-muted-foreground">{complianceProfile.jurisdictionState}</span>
            </div>
            {complianceProfile.businessRegistrationNumber && (
              <p className="text-muted-foreground">Registration / EIN: {complianceProfile.businessRegistrationNumber}</p>
            )}
            <p className="text-muted-foreground">Address: {complianceProfile.registeredAddress}</p>
            {complianceProfile.insuranceCarrier && (
              <p className="text-muted-foreground">
                Insurance: {complianceProfile.insuranceCarrier} {complianceProfile.insurancePolicyNumber ? `(#${complianceProfile.insurancePolicyNumber})` : ""}
              </p>
            )}
            {complianceProfile.dotMcNumber && (
              <p className="inline-flex items-center gap-1 font-mono text-xs font-medium text-secondary-foreground">
                <Truck className="size-3" aria-hidden />
                DOT/MC Authority: {complianceProfile.dotMcNumber}
              </p>
            )}
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setShowComplianceForm(true)}
                className="text-xs text-brand-link underline"
              >
                Update Registration
              </button>
            </div>
          </div>
        )}

        {(showComplianceForm || !complianceProfile) && (
          <form
            className="mt-3 flex flex-col gap-2.5"
            action={async (fd) => {
              setBusy("compliance");
              setError(null);
              const res = await saveComplianceProfile(fd);
              setBusy(null);
              if (res.ok) {
                setNotice("Legal compliance profile saved successfully.");
                setShowComplianceForm(false);
                router.refresh();
              } else {
                setError(res.error ?? "Failed to save compliance profile.");
              }
            }}
          >
            <input
              name="legalEntityName"
              required
              defaultValue={complianceProfile?.legalEntityName ?? ""}
              placeholder="Legal Business / Entity Name (e.g. Apex Kennels LLC)"
              className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                name="jurisdictionState"
                required
                maxLength={2}
                defaultValue={complianceProfile?.jurisdictionState ?? ""}
                placeholder="State (e.g. OH)"
                className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm uppercase"
              />
              <input
                name="businessRegistrationNumber"
                defaultValue={complianceProfile?.businessRegistrationNumber ?? ""}
                placeholder="EIN / Registration #"
                className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
              />
            </div>
            <input
              name="registeredAddress"
              required
              defaultValue={complianceProfile?.registeredAddress ?? ""}
              placeholder="Registered Physical Address"
              className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                name="insuranceCarrier"
                defaultValue={complianceProfile?.insuranceCarrier ?? ""}
                placeholder="Insurance Carrier (optional)"
                className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
              />
              <input
                name="insurancePolicyNumber"
                defaultValue={complianceProfile?.insurancePolicyNumber ?? ""}
                placeholder="Policy # (optional)"
                className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
              />
            </div>
            <input
              name="dotMcNumber"
              defaultValue={complianceProfile?.dotMcNumber ?? ""}
              placeholder="USDOT or MC Number (for Transport Carriers)"
              className="min-h-11 rounded-xl border border-input bg-transparent px-3 text-sm"
            />
            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                disabled={busy === "compliance"}
                className="min-h-11 rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link disabled:opacity-50"
              >
                {busy === "compliance" ? "Saving..." : "Save Compliance Details"}
              </button>
              {complianceProfile && (
                <button
                  type="button"
                  onClick={() => setShowComplianceForm(false)}
                  className="min-h-11 rounded-xl border border-input px-4 text-sm font-medium"
                >
                  Cancel
                </button>
              )}
            </div>
          </form>
        )}
      </section>

      {/* Module 3: 30-Day Standing Contract & Deposit Policy */}
      <section className="premium-panel rounded-2xl p-4" data-testid="standing-policy-section">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Scale className="size-4 text-brand-link" aria-hidden />
            <h2 className="text-sm font-semibold">30-Day Standing Policy & Contract Terms</h2>
          </div>
          {isPolicyLocked ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-secondary/25 px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
              <Lock className="size-3" aria-hidden />
              Locked 30 Days
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/40 px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              Unlocked
            </span>
          )}
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Marketplace integrity rule: standing policies guarantee that sellers cannot alter contract deposit terms mid-season. Once active, terms stand firm for 30 days to protect both parties.
        </p>

        {standingPolicy && !showPolicyForm && (
          <div className="mt-3 space-y-1.5 rounded-xl border border-border/60 bg-muted/20 p-3 text-xs leading-relaxed">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold">
                {standingPolicy.depositRefundablePolicy === "escrow_until_handover"
                  ? "Escrow Until Handover"
                  : "Non-Refundable on Buyer Default"}
              </span>
              <span className="font-mono">{Math.round(standingPolicy.defaultDepositBps / 100)}% Deposit</span>
            </div>
            <p className="text-muted-foreground">
              Terms: &quot;{standingPolicy.contractDisclosureTerms}&quot;
            </p>
            {isPolicyLocked ? (
              <p className="flex items-center gap-1 pt-1 text-xs text-muted-foreground">
                <Lock className="size-3" aria-hidden />
                Locked until {new Date(standingPolicy.lockedUntil).toLocaleDateString()}
              </p>
            ) : (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowPolicyForm(true)}
                  className="text-xs text-brand-link underline"
                >
                  Edit Terms
                </button>
              </div>
            )}
          </div>
        )}

        {(showPolicyForm || !standingPolicy) && (
          <form
            className="mt-3 flex flex-col gap-2.5"
            action={async () => {
              if (isPolicyLocked) return;
              setBusy("policy");
              setError(null);
              const res = await saveStandingPolicy(
                depositPolicy,
                depositPercent * 100,
                policyTerms
              );
              setBusy(null);
              if (res.ok) {
                setNotice("30-Day standing policy locked and saved.");
                setShowPolicyForm(false);
                router.refresh();
              } else {
                setError(res.error ?? "Failed to save standing policy.");
              }
            }}
          >
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Deposit Policy
              </label>
              <select
                value={depositPolicy}
                onChange={(e) => setDepositPolicy(e.target.value)}
                disabled={isPolicyLocked}
                className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm disabled:opacity-60"
              >
                <option value="escrow_until_handover">Escrow until animal handover (Standard)</option>
                <option value="non_refundable_on_default">Non-refundable if buyer defaults without cause</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Standard Deposit Percentage (%)
              </label>
              <input
                type="number"
                min={5}
                max={50}
                value={depositPercent}
                onChange={(e) => setDepositPercent(Number(e.target.value))}
                disabled={isPolicyLocked}
                className="min-h-11 w-full rounded-xl border border-input bg-transparent px-3 text-sm disabled:opacity-60"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                Standard Contract Terms & Disclosure
              </label>
              <textarea
                rows={3}
                value={policyTerms}
                onChange={(e) => setPolicyTerms(e.target.value)}
                disabled={isPolicyLocked}
                className="w-full rounded-xl border border-input bg-transparent p-3 text-sm disabled:opacity-60"
              />
            </div>
            {isPolicyLocked ? (
              <p className="text-xs text-muted-foreground">
                Policy is currently locked until {new Date(standingPolicy!.lockedUntil).toLocaleDateString()} under the 30-Day Policy rule.
              </p>
            ) : (
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="submit"
                  disabled={busy === "policy"}
                  className="min-h-11 rounded-xl bg-primary/15 px-4 text-sm font-medium text-brand-link disabled:opacity-50"
                >
                  {busy === "policy" ? "Locking..." : "Save & Lock for 30 Days"}
                </button>
                {standingPolicy && (
                  <button
                    type="button"
                    onClick={() => setShowPolicyForm(false)}
                    className="min-h-11 rounded-xl border border-input px-4 text-sm font-medium"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </form>
        )}
      </section>

      {/* Per-animal eligibility — verified seller ≠ every animal listable. */}
      <section className="premium-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">{t("animalsTitle")}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("animalsBody")}</p>
        {creatures.length === 0 ? (
          <p className="mt-3 text-xs text-muted-foreground">{t("animalsEmpty")}</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2" data-testid="animal-eligibility-list">
            {creatures.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-muted/25 p-3 text-sm"
              >
                <span className="font-medium">{c.name}</span>
                {attested.has(c.id) ? (
                  <span
                    className="inline-flex items-center gap-1 text-xs font-medium text-secondary-foreground"
                    data-testid={`animal-attested-${c.id}`}
                  >
                    <BadgeCheck className="size-4" aria-hidden />
                    {t("animalAttested")}
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      setBusy(c.id);
                      setError(null);
                      const result = await attestAnimalEligibility(c.id);
                      setBusy(null);
                      if (result.ok) router.refresh();
                      else setError(t("error.generic"));
                    }}
                    disabled={busy === c.id}
                    data-testid={`attest-animal-${c.id}`}
                    className="min-h-11 rounded-xl border border-input px-3 text-xs font-medium disabled:opacity-50"
                  >
                    {t("attestAnimal")}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Buyer readiness — attestation only in v1. */}
      <section className="premium-panel rounded-2xl p-4">
        <h2 className="text-sm font-semibold">{t("buyerTitle")}</h2>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{t("buyerBody")}</p>
        {state.buyerAttested ? (
          <p className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-secondary-foreground" data-testid="buyer-attested">
            <BadgeCheck className="size-4" aria-hidden />
            {t("buyerAttested")}
          </p>
        ) : (
          <button
            type="button"
            onClick={async () => {
              setBusy("buyer");
              setError(null);
              const result = await attestBuyerReadiness();
              setBusy(null);
              if (result.ok) router.refresh();
              else setError(t("error.generic"));
            }}
            disabled={busy === "buyer"}
            data-testid="attest-buyer"
            className="mt-3 min-h-11 rounded-xl border border-input px-4 text-sm font-medium disabled:opacity-50"
          >
            {t("attestBuyer")}
          </button>
        )}
      </section>
    </div>
  );
}
