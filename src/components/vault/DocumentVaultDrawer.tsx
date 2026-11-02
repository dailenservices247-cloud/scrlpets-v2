"use client";

import { useEffect, useState } from "react";
import {
  FileText,
  X,
  Upload,
  CheckCircle2,
  FolderOpen,
  Filter,
} from "lucide-react";
import {
  type VaultDocument,
  type DocumentCategory,
  DOCUMENT_CATEGORY_META,
} from "@/lib/vault/documents";
import { taxonomyLabelForSpecies } from "@/lib/species/identity";

const SAMPLE_VAULT_DOCUMENTS: VaultDocument[] = [
  {
    id: "doc-1",
    ownerId: "user-me",
    title: "USDA Interstate Movement Permit (PPQ 526)",
    category: "permit",
    species: "insect",
    fileUrl: "https://example.com/permits/usda-526-ant-colony.pdf",
    fileType: "application/pdf",
    issuer: "USDA APHIS",
    verified: true,
    createdAt: "2026-10-15T12:00:00Z",
    metadata: {
      permitNumber: "P526-26-89410",
      casteOrMorph: "Camponotus Pennsylvanicus",
    },
  },
  {
    id: "doc-2",
    ownerId: "user-me",
    title: "Captive-Bred Lineage & Morph Certificate",
    category: "provenance",
    species: "reptile",
    fileUrl: "https://example.com/certificates/gecko-morph-lineage.pdf",
    fileType: "application/pdf",
    issuer: "USARK Registry",
    verified: true,
    createdAt: "2026-09-20T10:00:00Z",
    metadata: {
      casteOrMorph: "Tangerine Tremper Albino",
    },
  },
  {
    id: "doc-3",
    ownerId: "user-me",
    title: "Live Arrival Guarantee (LAG) & Handover Terms",
    category: "contract",
    species: "reptile",
    fileUrl: "https://example.com/contracts/live-arrival-guarantee-terms.pdf",
    fileType: "application/pdf",
    issuer: "Scrlpets Standard Escrow",
    verified: true,
    createdAt: "2026-10-01T14:30:00Z",
    metadata: {
      lagGuaranteeHours: 2,
    },
  },
  {
    id: "doc-4",
    ownerId: "user-me",
    title: "Rabies & Core DHPP Vaccination Certificate",
    category: "health_record",
    species: "dog",
    fileUrl: "https://example.com/records/dhpp-rabies-passport.pdf",
    fileType: "application/pdf",
    issuer: "North Star Veterinary DVM",
    verified: true,
    createdAt: "2026-08-10T09:15:00Z",
    metadata: {
      microchipNumber: "985141004829104",
      expirationDate: "2027-08-10",
    },
  },
  {
    id: "doc-5",
    ownerId: "user-me",
    title: "Commercial Livestock & Pet Carrier Authority (DOT)",
    category: "compliance",
    species: null,
    fileUrl: "https://example.com/compliance/dot-mc-carrier-authority.pdf",
    fileType: "application/pdf",
    issuer: "USDOT / FMCSA",
    verified: true,
    createdAt: "2026-07-04T16:00:00Z",
    metadata: {
      permitNumber: "MC-984210",
    },
  },
];

export function DocumentVaultDrawer({
  isOpen,
  onClose,
  onSelectDocument,
  title = "Unified Document Vault",
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelectDocument?: (doc: VaultDocument) => void;
  title?: string;
}) {
  const [documents, setDocuments] = useState<VaultDocument[]>(SAMPLE_VAULT_DOCUMENTS);
  const [selectedCategory, setSelectedCategory] = useState<DocumentCategory | "all">("all");
  const [selectedSpecies, setSelectedSpecies] = useState<string>("all");
  const [isUploading, setIsUploading] = useState(false);

  // New Document Upload State
  const [newTitle, setNewTitle] = useState("");
  const [newCategory, setNewCategory] = useState<DocumentCategory>("health_record");
  const [newSpecies, setNewSpecies] = useState("dog");
  const [newIssuer, setNewIssuer] = useState("");

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const filtered = documents.filter((d) => {
    const matchCat = selectedCategory === "all" || d.category === selectedCategory;
    const matchSpecies =
      selectedSpecies === "all" ||
      (d.species && d.species.toLowerCase() === selectedSpecies.toLowerCase());
    return matchCat && matchSpecies;
  });

  const handleUploadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;

    const newDoc: VaultDocument = {
      id: `doc-${Date.now()}`,
      ownerId: "user-me",
      title: newTitle.trim(),
      category: newCategory,
      species: newSpecies || null,
      fileUrl: "https://example.com/vault/user-uploaded-record.pdf",
      fileType: "application/pdf",
      issuer: newIssuer.trim() || "Owner Declared",
      verified: true,
      createdAt: new Date().toISOString(),
    };

    setDocuments([newDoc, ...documents]);
    setIsUploading(false);
    setNewTitle("");
    setNewIssuer("");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/75 p-0 sm:p-4 backdrop-blur-sm"
      onClick={onClose}
      data-testid="document-vault-modal"
    >
      <div
        className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border/70 p-4">
          <div className="flex items-center gap-2.5">
            <span className="grid size-9 place-items-center rounded-xl bg-primary/15 text-brand-link">
              <FolderOpen className="size-5" />
            </span>
            <div>
              <h3 className="text-base font-semibold">{title}</h3>
              <p className="text-xs text-muted-foreground">
                Universal repository for health, permits, contracts, and lineage
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsUploading(!isUploading)}
              className="flex items-center gap-1.5 rounded-lg bg-primary/15 px-3 py-1.5 text-xs font-semibold text-brand-link transition hover:bg-primary/25"
              data-testid="vault-upload-toggle-btn"
            >
              <Upload className="size-3.5" />
              <span>{isUploading ? "Browse Files" : "Upload Document"}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="grid size-8 place-items-center rounded-lg text-muted-foreground hover:bg-muted"
              aria-label="Close vault"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {isUploading ? (
          /* Upload Form */
          <form onSubmit={handleUploadSubmit} className="flex flex-col gap-3 p-4 overflow-y-auto">
            <h4 className="text-sm font-semibold">Store New Document in Vault</h4>
            <p className="text-xs text-muted-foreground">
              Documents stored here can be attached to transactions, verified during buyer handovers, or shared directly in DMs.
            </p>

            <div>
              <label className="text-xs font-medium text-foreground">Document Title</label>
              <input
                type="text"
                placeholder="e.g. CITES Certificate, Fecal Panel, Microchip Registration"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background p-2 text-sm"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground">Category</label>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as DocumentCategory)}
                  className="mt-1 w-full rounded-xl border border-input bg-background p-2 text-sm"
                >
                  <option value="health_record">Health & Vet Record</option>
                  <option value="provenance">Lineage & Provenance</option>
                  <option value="permit">Permits & Transport</option>
                  <option value="contract">Contracts & LAG</option>
                  <option value="compliance">Entity & Compliance</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground">Species Category</label>
                <select
                  value={newSpecies}
                  onChange={(e) => setNewSpecies(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-input bg-background p-2 text-sm"
                >
                  <option value="dog">Canine (Dog)</option>
                  <option value="cat">Feline (Cat)</option>
                  <option value="reptile">Reptile (Lizard, Snake)</option>
                  <option value="insect">Insect / Colony (Ants, Bees)</option>
                  <option value="bird">Avian (Bird, Parrot)</option>
                  <option value="rabbit">Lagomorph (Rabbit)</option>
                  <option value="fish">Aquatic (Fish)</option>
                  <option value="other">Universal / Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs font-medium text-foreground">Issuing Authority / Clinic</label>
              <input
                type="text"
                placeholder="e.g. USDA APHIS, Dr. Smith DVM, USARK, Captive Foundation"
                value={newIssuer}
                onChange={(e) => setNewIssuer(e.target.value)}
                className="mt-1 w-full rounded-xl border border-input bg-background p-2 text-sm"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsUploading(false)}
                className="rounded-xl border border-input px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="rounded-xl bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
              >
                Save to Vault
              </button>
            </div>
          </form>
        ) : (
          /* Document List View */
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Filter Pills */}
            <div className="flex flex-col gap-2 border-b border-border/70 p-3 bg-muted/20">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
                <span className="flex items-center gap-1 text-micro font-semibold uppercase tracking-wider text-muted-foreground mr-1">
                  <Filter className="size-3" />
                  Category:
                </span>
                {(["all", "health_record", "provenance", "permit", "contract", "compliance"] as const).map(
                  (cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`shrink-0 rounded-full px-2.5 py-1 text-micro font-medium transition ${
                        selectedCategory === cat
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "border border-border/70 bg-card hover:bg-muted"
                      }`}
                    >
                      {cat === "all" ? "All Files" : DOCUMENT_CATEGORY_META[cat]?.label.split(" ")[0]}
                    </button>
                  ),
                )}
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
                <span className="text-micro font-semibold uppercase tracking-wider text-muted-foreground mr-1">
                  Species:
                </span>
                {(["all", "insect", "reptile", "dog", "cat", "bird", "fish"] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setSelectedSpecies(s)}
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-micro font-medium transition ${
                      selectedSpecies === s
                        ? "bg-brand-link text-white font-semibold"
                        : "border border-border/60 bg-card text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s === "all" ? "All Species" : s.charAt(0).toUpperCase() + s.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
              {filtered.length === 0 ? (
                <div className="py-8 text-center text-sm text-muted-foreground">
                  No documents found matching the selected filters.
                </div>
              ) : (
                filtered.map((doc) => {
                  const meta = DOCUMENT_CATEGORY_META[doc.category];
                  const taxonomyLabel = taxonomyLabelForSpecies(doc.species);
                  return (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/70 bg-card p-3 shadow-sm hover:border-primary/40 transition"
                      data-testid={`vault-item-${doc.id}`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/15 text-brand-link">
                          <FileText className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{doc.title}</p>
                          <div className="flex flex-wrap items-center gap-2 text-micro text-muted-foreground">
                            <span>{meta.label}</span>
                            <span>•</span>
                            <span className="capitalize">
                              {doc.species ? `${doc.species} (${taxonomyLabel})` : "General"}
                            </span>
                            {doc.issuer && (
                              <>
                                <span>•</span>
                                <span>{doc.issuer}</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {onSelectDocument ? (
                          <button
                            type="button"
                            onClick={() => onSelectDocument(doc)}
                            className="flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                            data-testid={`vault-attach-btn-${doc.id}`}
                          >
                            <CheckCircle2 className="size-3.5" />
                            <span>Attach</span>
                          </button>
                        ) : (
                          <a
                            href={doc.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted"
                          >
                            View
                          </a>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
