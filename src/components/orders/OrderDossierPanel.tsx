"use client";

import { useState } from "react";
import { Printer, Shield, ShieldCheck } from "lucide-react";
import { formatPrice } from "@/lib/shop/format";
import type { CounterpartyDossier } from "@/lib/contracts/queries";
import { Button } from "@/components/ui/button";

export function OrderDossierPanel({
  dossier,
  transportPayoutPolicy,
  transportSurchargeCents,
}: {
  dossier: CounterpartyDossier | null;
  transportPayoutPolicy?: string;
  transportSurchargeCents?: number;
}) {
  const [open, setOpen] = useState(false);

  if (!dossier) {
    return (
      <section className="premium-panel rounded-2xl p-4" data-testid="dossier-pending">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          <Shield className="size-4 text-brand-link" aria-hidden />
          <span>Counterparty Protection Dossier</span>
        </div>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Verified counterparty registration and audit dossier unlocks as soon as the first escrow stage is funded.
        </p>
      </section>
    );
  }

  const { contract, seller, buyer, transporter, creature, ledger, audit } = dossier;

  return (
    <section className="premium-panel rounded-2xl p-4" data-testid="order-dossier-panel">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-secondary/20 text-secondary-foreground">
            <ShieldCheck className="size-4" aria-hidden />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Verified Transaction Packet
            </p>
            <h2 className="text-sm font-bold">Counterparty Dossier & Legal Shield</h2>
          </div>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setOpen((v) => !v)}
          data-testid="toggle-dossier-btn"
        >
          {open ? "Hide Details" : "View Packet"}
        </Button>
      </div>

      {/* Contract & Carrier Payout Policy Summary (always visible) */}
      <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
          <p className="font-semibold text-foreground">Escrow & Legal Terms</p>
          <p className="mt-1 text-muted-foreground">
            Price: <strong className="text-foreground">{formatPrice(dossier.amount_cents, dossier.currency)}</strong>
            {dossier.deposit_cents > 0 && ` · Deposit: ${formatPrice(dossier.deposit_cents, dossier.currency)}`}
          </p>
          {contract && (
            <p className="mt-0.5 text-muted-foreground">
              Signed on {new Date(contract.seller_signed_at).toLocaleDateString()} by @{seller.username}
            </p>
          )}
        </div>

        <div className="rounded-xl border border-border/70 bg-muted/20 p-2.5">
          <p className="font-semibold text-foreground">Transport Policy & Payout</p>
          <p className="mt-1 text-muted-foreground">
            Policy: <strong className="text-foreground">{transporter?.payout_policy ?? transportPayoutPolicy ?? "paid_on_show_up"}</strong>
          </p>
          {(dossier.transport_surcharge_cents > 0 || (transportSurchargeCents ?? 0) > 0) && (
            <p className="mt-0.5 text-muted-foreground">
              Platform Surcharge: {formatPrice(dossier.transport_surcharge_cents || transportSurchargeCents || 0, dossier.currency)}
            </p>
          )}
        </div>
      </div>

      {open && (
        <div className="mt-4 space-y-4 border-t pt-4 text-xs" data-testid="dossier-full-view">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-foreground">Verified Entity Dossier</span>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 text-brand-link hover:underline"
            >
              <Printer className="size-3.5" aria-hidden />
              Print / Save PDF
            </button>
          </div>

          {/* Counterparties */}
          <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
            <p className="font-semibold text-foreground">Buyer Identity</p>
            <p className="mt-1 text-muted-foreground">
              Account: <span className="font-medium text-foreground">@{buyer.username}</span>
            </p>
          </div>

          {/* Seller Verified Credentials */}
          <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
            <p className="font-semibold text-foreground">Seller / Breeder Profile</p>
            <dl className="mt-1 grid grid-cols-2 gap-1 text-muted-foreground">
              <dt>Legal Entity:</dt>
              <dd className="font-medium text-foreground">{seller.legal_entity_name || "Private Independent Seller"}</dd>
              {seller.registration_number && (
                <>
                  <dt>Business Reg #:</dt>
                  <dd className="font-medium text-foreground">{seller.registration_number}</dd>
                </>
              )}
              {seller.state && (
                <>
                  <dt>Jurisdiction State:</dt>
                  <dd className="font-medium text-foreground">{seller.state}</dd>
                </>
              )}
              {seller.registered_address && (
                <>
                  <dt>Registered Address:</dt>
                  <dd className="font-medium text-foreground">{seller.registered_address}</dd>
                </>
              )}
              {seller.insurance_carrier && (
                <>
                  <dt>Insurance Policy:</dt>
                  <dd className="font-medium text-foreground">{seller.insurance_carrier} ({seller.insurance_policy_number || "Active"})</dd>
                </>
              )}
            </dl>
          </div>

          {/* Transporter Details */}
          {transporter && (
            <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
              <p className="font-semibold text-foreground">Transport Carrier Entity</p>
              <dl className="mt-1 grid grid-cols-2 gap-1 text-muted-foreground">
                <dt>Carrier Legal Name:</dt>
                <dd className="font-medium text-foreground">{transporter.legal_entity_name || `@${transporter.username}`}</dd>
                {transporter.dot_mc_number && (
                  <>
                    <dt>USDOT / MC #:</dt>
                    <dd className="font-medium text-foreground">{transporter.dot_mc_number}</dd>
                  </>
                )}
                {transporter.credential_number && (
                  <>
                    <dt>USDA / Authority:</dt>
                    <dd className="font-medium text-foreground">{transporter.issuing_authority} · {transporter.credential_number}</dd>
                  </>
                )}
                <dt>Payout Payout Policy:</dt>
                <dd className="font-medium text-foreground">{transporter.payout_policy}</dd>
              </dl>
            </div>
          )}

          {/* Animal Anchor & Custody Verification */}
          {creature && (
            <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
              <p className="font-semibold text-foreground">Animal Anchor & Identity</p>
              <p className="mt-1 text-muted-foreground">
                Subject: <strong className="text-foreground">{creature.name}</strong> ({creature.species ?? "animal"})
                {creature.anchor_type && ` · Verification Anchor: ${creature.anchor_type}`}
              </p>
              <p className="mt-0.5 text-micro text-muted-foreground">
                Cryptographic custody handovers verified via microchip scan and one-time party codes.
              </p>
            </div>
          )}

          {/* Ledger & Audit Trail */}
          <div className="rounded-xl border border-border/60 bg-muted/15 p-3">
            <p className="font-semibold text-foreground">Immutable Ledger & Escrow Audit</p>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground">
              <span>Total Captured: <strong className="text-foreground">{formatPrice(ledger.captured_cents, dossier.currency)}</strong></span>
              <span>Buyer Fee: {formatPrice(ledger.buyer_fee_cents, dossier.currency)}</span>
              <span>Seller Fee: {formatPrice(ledger.seller_fee_cents, dossier.currency)}</span>
              <span>Audit Trail Events: <strong className="text-foreground">{audit.immutable_events_count}</strong></span>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
