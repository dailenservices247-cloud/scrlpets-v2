export type DocumentCategory =
  | "health_record"
  | "provenance"
  | "permit"
  | "contract"
  | "compliance";

export type VaultDocument = {
  id: string;
  ownerId: string;
  title: string;
  category: DocumentCategory;
  species: string | null;
  creatureId?: string | null;
  creatureName?: string | null;
  fileUrl: string;
  fileType: string;
  issuer?: string | null;
  verified: boolean;
  createdAt: string;
  metadata?: {
    microchipNumber?: string;
    casteOrMorph?: string;
    permitNumber?: string;
    expirationDate?: string;
    lagGuaranteeHours?: number;
  };
};

export const DOCUMENT_CATEGORY_META: Record<
  DocumentCategory,
  { label: string; description: string }
> = {
  health_record: {
    label: "Health & Vet Records",
    description: "Vaccination certificates, vet wellness exams, fecal/crypto panels, and CVI travel certificates",
  },
  provenance: {
    label: "Lineage & Provenance",
    description: "Pedigree papers, captive-bred documentation, hatch certificates, and queen ant locality collection provenance",
  },
  permit: {
    label: "Permits & Legal Transport",
    description: "USDA PPQ 526 insect movement permits, USARK reptile certificates, CITES papers, and state transport licenses",
  },
  contract: {
    label: "Contracts & Guarantees",
    description: "Purchase agreements, Live Arrival Guarantees (LAG), health warranties, and co-ownership contracts",
  },
  compliance: {
    label: "Entity & Business Compliance",
    description: "EIN letters, business registrations, DOT/MC carrier filings, and commercial liability insurance",
  },
};

/**
 * Encodes a vault document reference into message body format.
 */
export function encodeVaultDocumentMessage(doc: VaultDocument): string {
  return `[vault-doc:${doc.id}|${doc.category}|${doc.title}|${encodeURIComponent(doc.fileUrl)}|${doc.species || "general"}]`;
}

/**
 * Parses a vault document reference from a message body if present.
 */
export function parseVaultDocumentMessage(body: string | null): {
  id: string;
  category: DocumentCategory;
  title: string;
  fileUrl: string;
  species: string;
} | null {
  if (!body) return null;
  const match = body.match(/\[vault-doc:([^|]+)\|([^|]+)\|([^|]+)\|([^|]+)\|([^\]]+)\]/);
  if (!match) return null;
  return {
    id: match[1],
    category: match[2] as DocumentCategory,
    title: match[3],
    fileUrl: decodeURIComponent(match[4]),
    species: match[5],
  };
}
