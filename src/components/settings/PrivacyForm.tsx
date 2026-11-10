"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { GitFork, Eye, ShieldCheck, Scale, ArrowRight, Check } from "lucide-react";
import type { TreePrivacy } from "@/lib/tree/queries";
import { setTreePrivacy } from "@/lib/tree/actions";
import { setReadReceipts } from "@/lib/messaging/actions";
import { cn } from "@/lib/utils";

export function PrivacyForm({
  initialTreePrivacy = "public",
  initialReadReceipts = true,
}: {
  initialTreePrivacy?: TreePrivacy;
  initialReadReceipts?: boolean;
}) {
  const [treePrivacy, setTreePrivacyState] = useState<TreePrivacy>(initialTreePrivacy);
  const [readReceipts, setReadReceiptsState] = useState(initialReadReceipts);
  const [savedNotice, setSavedNotice] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleTreePrivacyChange(value: TreePrivacy) {
    setTreePrivacyState(value);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("treePrivacy", value);
      await setTreePrivacy(fd);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    });
  }

  function handleReadReceiptsToggle() {
    const next = !readReceipts;
    setReadReceiptsState(next);
    startTransition(async () => {
      await setReadReceipts(next);
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    });
  }

  return (
    <div className="flex flex-col gap-6" data-testid="privacy-settings-form">
      {savedNotice && (
        <div
          className="flex items-center gap-2 rounded-xl border border-secondary/40 bg-secondary/15 p-3.5 text-xs font-semibold text-secondary-foreground"
          role="status"
        >
          <Check className="size-4 shrink-0" />
          <span>Privacy preferences updated.</span>
        </div>
      )}

      {/* 1. Pedigree & Lineage Tree Privacy */}
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center gap-2">
          <GitFork className="size-4.5 text-brand-link" />
          <h2 className="text-sm font-bold text-foreground">Pedigree & Lineage Tree Privacy</h2>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Controls who can inspect your full ancestral lineage trees, coefficient of inbreeding (COI), and breeding stock relations.
        </p>

        <div className="mt-3.5 grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {[
            { id: "public", title: "Public", desc: "Anyone on Scrlpets can view full pedigrees" },
            { id: "buyers", title: "Buyers & Pack", desc: "Restricted to verified buyers & pack members" },
            { id: "private", title: "Private", desc: "Only you and co-owners can view lineage" },
          ].map((opt) => {
            const isSelected = treePrivacy === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={pending}
                onClick={() => handleTreePrivacyChange(opt.id as TreePrivacy)}
                className={cn(
                  "flex min-h-14 flex-col justify-center rounded-xl border p-3 text-left transition",
                  isSelected
                    ? "border-primary/60 bg-primary/10 text-foreground"
                    : "border-border/70 bg-card/60 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
                data-testid={`privacy-tree-${opt.id}`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground">{opt.title}</span>
                  {isSelected && <Check className="size-4 text-brand-link" />}
                </div>
                <span className="mt-1 text-micro text-muted-foreground leading-tight">
                  {opt.desc}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Read Receipts & Messaging Privacy */}
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-secondary/15 text-secondary-foreground">
              <Eye className="size-4.5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">Message Read Receipts</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Reciprocal receipts: when turned off, you neither send read confirmations nor see when others read your messages.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleReadReceiptsToggle}
            disabled={pending}
            role="switch"
            aria-checked={readReceipts}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full transition-colors duration-200 focus:outline-hidden",
              readReceipts ? "bg-primary" : "bg-muted"
            )}
            data-testid="toggle-read-receipts"
          >
            <span
              className={cn(
                "inline-block size-5 transform rounded-full bg-white shadow-xs transition duration-200",
                readReceipts ? "translate-x-5.5" : "translate-x-0.5"
              )}
            />
          </button>
        </div>
      </section>

      {/* 3. Verified Identity Navigation */}
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-brand-link">
              <ShieldCheck className="size-4.5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">Verified Identity & Trust Gates</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Animal selling and stud listings require identity verification via Stripe Identity to prevent fraud.
              </p>
            </div>
          </div>
          <Link
            href="/settings/verification"
            className="flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/10 px-3.5 py-2 text-xs font-semibold text-brand-link transition hover:bg-primary/20 shrink-0"
          >
            <span>Verification Status</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>

      {/* 4. Statutory Companion & Exotic Animal Guide Link */}
      <section className="premium-panel rounded-2xl p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-accent/15 text-accent-foreground">
              <Scale className="size-4.5" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-foreground">Companion & Exotic Animal Statutory Guide</h2>
              <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                Review federal Lacey Act prohibitions, Big Cat Public Safety Act mandates, Ohio ORC Chapter 935 black-list exemptions, and Toledo TMC municipal codes.
              </p>
            </div>
          </div>
          <Link
            href="/guides/animal-legality"
            className="flex items-center gap-1.5 rounded-xl border border-border/80 bg-card px-3.5 py-2 text-xs font-semibold text-foreground transition hover:bg-muted shrink-0"
          >
            <span>Explore Tiers</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>
    </div>
  );
}
