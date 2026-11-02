"use client";

import { FileText, ShieldCheck, Download, ExternalLink } from "lucide-react";
import { type DocumentCategory, DOCUMENT_CATEGORY_META } from "@/lib/vault/documents";
import { taxonomyLabelForSpecies } from "@/lib/species/identity";

export function VaultDocumentCard({
  title,
  category,
  species,
  fileUrl,
  verified = true,
  issuer,
  isMine = false,
}: {
  title: string;
  category: DocumentCategory;
  species?: string | null;
  fileUrl: string;
  verified?: boolean;
  issuer?: string | null;
  isMine?: boolean;
}) {
  const meta = DOCUMENT_CATEGORY_META[category] || { label: "Vault Document" };
  const taxonomyLabel = taxonomyLabelForSpecies(species);

  return (
    <div
      className={`mt-2 flex w-72 max-w-full flex-col gap-2.5 rounded-xl border p-3 shadow-sm transition ${
        isMine
          ? "border-primary-foreground/30 bg-primary-foreground/10 text-primary-foreground"
          : "border-border/70 bg-card text-card-foreground"
      }`}
      data-testid="vault-document-card"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span
            className={`grid size-8 place-items-center rounded-lg ${
              isMine ? "bg-primary-foreground/20 text-white" : "bg-primary/15 text-brand-link"
            }`}
          >
            <FileText className="size-4" />
          </span>
          <div className="min-w-0">
            <span className="block text-micro font-medium uppercase tracking-wider opacity-80">
              {meta.label}
            </span>
            <p className="truncate text-xs font-semibold">{title}</p>
          </div>
        </div>

        {verified && (
          <span
            className="flex shrink-0 items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-micro font-medium text-emerald-600 dark:text-emerald-400"
            title="Verified Document"
          >
            <ShieldCheck className="size-3" />
            <span>Verified</span>
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-micro opacity-85">
        <span className="capitalize">
          {species ? `${species} (${taxonomyLabel})` : "Universal Document"}
        </span>
        {issuer && <span>Issued by: {issuer}</span>}
      </div>

      <div className="flex items-center gap-2 pt-1 border-t border-current/10">
        <a
          href={fileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex flex-1 items-center justify-center gap-1 rounded-lg py-1.5 text-xs font-semibold transition ${
            isMine
              ? "bg-white text-primary hover:bg-white/90"
              : "bg-primary/15 text-brand-link hover:bg-primary/25"
          }`}
          data-testid="vault-doc-view-btn"
        >
          <ExternalLink className="size-3.5" />
          <span>View Document</span>
        </a>
        <a
          href={fileUrl}
          download
          className={`grid size-8 place-items-center rounded-lg border transition ${
            isMine
              ? "border-primary-foreground/30 hover:bg-primary-foreground/20 text-white"
              : "border-border hover:bg-muted text-foreground"
          }`}
          aria-label="Download document"
          data-testid="vault-doc-download-btn"
        >
          <Download className="size-3.5" />
        </a>
      </div>
    </div>
  );
}
